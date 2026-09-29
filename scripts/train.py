import argparse
import sys
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from dataset import MoveDataset
from model import MovePredictor


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True)
    p.add_argument("--epochs", type=int, default=5)
    p.add_argument("--batch-size", type=int, default=256)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--val-fraction", type=float, default=0.05)
    p.add_argument("--out", default="model.pt")
    p.add_argument("--channels", type=int, default=96)
    p.add_argument("--blocks", type=int, default=8)
    return p.parse_args()


def evaluate(model, loader, device):
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for boards, labels in loader:
            boards = boards.to(device)
            labels = labels.to(device)
            logits = model(boards)
            preds = logits.argmax(dim=1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)
    model.train()
    return correct / total if total else 0.0


def main():
    args = parse_args()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"device={device}")

    full_dataset = MoveDataset(args.data)
    val_size = int(len(full_dataset) * args.val_fraction)
    train_size = len(full_dataset) - val_size
    train_set, val_set = random_split(full_dataset, [train_size, val_size])
    print(f"train={train_size} val={val_size}")

    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_set, batch_size=args.batch_size, shuffle=False, num_workers=2)

    model = MovePredictor(channels=args.channels, num_blocks=args.blocks).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(args.epochs):
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
        print(f"epoch={epoch} train_loss={train_loss:.4f} val_top1_acc={val_acc:.4f} time={elapsed:.1f}s")

    torch.save(model.state_dict(), args.out)
    print(f"saved to {args.out}")


if __name__ == "__main__":
    main()
