import json

import chess
import torch
from torch.utils.data import Dataset

from encoding import board_to_tensor, move_to_class


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

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, idx):
        fen, move_uci = self.examples[idx]
        board = chess.Board(fen)
        move = chess.Move.from_uci(move_uci)
        tensor = board_to_tensor(board)
        label = move_to_class(move)
        return torch.from_numpy(tensor), label
