import glob
import json
import shutil
import subprocess
import sys
import time

chess_src_candidates = glob.glob("/kaggle/input/**/chess-1.11.2", recursive=True)
if not chess_src_candidates:
    raise RuntimeError("could not locate chess-1.11.2 source under /kaggle/input")
chess_src = chess_src_candidates[0]
print(f"using chess source at {chess_src}", flush=True)

shutil.copytree(chess_src, "/tmp/chess-1.11.2", dirs_exist_ok=True)
subprocess.run(
    [sys.executable, "-m", "pip", "install", "-q", "--no-build-isolation", "/tmp/chess-1.11.2"],
    check=True,
)

data_path_candidates = glob.glob("/kaggle/input/**/lichess_2000_2300.jsonl", recursive=True)
if not data_path_candidates:
    raise RuntimeError("could not locate lichess_2000_2300.jsonl under /kaggle/input")
DATA_PATH = data_path_candidates[0]
print(f"using data at {DATA_PATH}", flush=True)

import chess
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split

PIECE_ORDER = [chess.PAWN, chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN, chess.KING]
NUM_PLANES = 18
MOVE_CLASSES = 64 * 64

OUT_PATH = "/kaggle/working/model.pt"

EPOCHS = 6
MAX_EXAMPLES = None
BATCH_SIZE = 512
LR = 1e-3
VAL_FRACTION = 0.02
CHANNELS = 96
BLOCKS = 8


def board_to_tensor(board):
    planes = np.zeros((NUM_PLANES, 8, 8), dtype=np.float32)
    for square, piece in board.piece_map().items():
        rank = chess.square_rank(square)
        file = chess.square_file(square)
        piece_index = PIECE_ORDER.index(piece.piece_type)
        color_offset = 0 if piece.color == chess.WHITE else 6
        planes[piece_index + color_offset, rank, file] = 1.0
    planes[12, :, :] = 1.0 if board.turn == chess.WHITE else 0.0
    planes[13, :, :] = 1.0 if board.has_kingside_castling_rights(chess.WHITE) else 0.0
    planes[14, :, :] = 1.0 if board.has_queenside_castling_rights(chess.WHITE) else 0.0
    planes[15, :, :] = 1.0 if board.has_kingside_castling_rights(chess.BLACK) else 0.0
    planes[16, :, :] = 1.0 if board.has_queenside_castling_rights(chess.BLACK) else 0.0
    if board.ep_square is not None:
        planes[17, chess.square_rank(board.ep_square), chess.square_file(board.ep_square)] = 1.0
    return planes


def move_to_class(move):
    return move.from_square * 64 + move.to_square


class MoveDataset(Dataset):
    def __init__(self, jsonl_path):
        self.examples = []
        with open(jsonl_path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                record = json.loads(line)
                self.examples.append((record["fen"], record["move"]))
                if MAX_EXAMPLES and len(self.examples) >= MAX_EXAMPLES:
                    break

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, idx):
        fen, move_uci = self.examples[idx]
        board = chess.Board(fen)
        move = chess.Move.from_uci(move_uci)
        tensor = board_to_tensor(board)
        label = move_to_class(move)
        return torch.from_numpy(tensor), label


class ResidualBlock(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        residual = x
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        return self.relu(out + residual)


class MovePredictor(nn.Module):
    def __init__(self, channels=96, num_blocks=8):
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv2d(NUM_PLANES, channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(channels),
            nn.ReLU(inplace=True),
        )
        self.blocks = nn.Sequential(*[ResidualBlock(channels) for _ in range(num_blocks)])
        self.policy_head = nn.Sequential(
            nn.Conv2d(channels, 32, kernel_size=1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Flatten(),
            nn.Linear(32 * 8 * 8, MOVE_CLASSES),
        )

    def forward(self, x):
        x = self.stem(x)
        x = self.blocks(x)
        return self.policy_head(x)


def evaluate(model, loader, device):
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for boards, labels in loader:
            boards = boards.to(device)
            labels = labels.to(device)
            preds = model(boards).argmax(dim=1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)
    model.train()
    return correct / total if total else 0.0


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"device={device} cuda_available={torch.cuda.is_available()}", flush=True)

    dataset = MoveDataset(DATA_PATH)
    val_size = int(len(dataset) * VAL_FRACTION)
    train_size = len(dataset) - val_size
    train_set, val_set = random_split(dataset, [train_size, val_size])
    print(f"train={train_size} val={val_size}", flush=True)

    train_loader = DataLoader(train_set, batch_size=BATCH_SIZE, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_set, batch_size=BATCH_SIZE, shuffle=False, num_workers=4)

    model = MovePredictor(channels=CHANNELS, num_blocks=BLOCKS).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(EPOCHS):
        start = time.time()
        running_loss = 0.0
        seen = 0
        for boards, labels in train_loader:
            boards = boards.to(device)
            labels = labels.to(device)
            optimizer.zero_grad()
            logits = model(boards)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * labels.size(0)
            seen += labels.size(0)
        train_loss = running_loss / seen
        val_acc = evaluate(model, val_loader, device)
        elapsed = time.time() - start
        print(f"epoch={epoch} train_loss={train_loss:.4f} val_top1_acc={val_acc:.4f} time={elapsed:.1f}s", flush=True)
        torch.save(model.state_dict(), OUT_PATH)

    print(f"saved to {OUT_PATH}", flush=True)


if __name__ == "__main__":
    main()
