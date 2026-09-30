import os

import chess
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from encoding import board_to_tensor, resolve_predicted_move
from model import MovePredictor

MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(os.path.dirname(__file__), "..", "models", "move_predictor_v1.pt"))

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = MovePredictor()
model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
model.to(device)
model.eval()


class PositionRequest(BaseModel):
    fen: str


def predict_move(board):
    tensor = board_to_tensor(board).reshape(1, 18, 8, 8)
    with torch.no_grad():
        logits = model(torch.from_numpy(tensor).to(device))
    ranked = torch.argsort(logits[0], descending=True)
    for class_index in ranked.tolist():
        move = resolve_predicted_move(board, class_index)
        if move is not None:
            probs = torch.softmax(logits[0], dim=0)
            return move, probs[class_index].item()
    return None, 0.0


@app.post("/next-move")
def next_move(body: PositionRequest):
    try:
        board = chess.Board(body.fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid fen")

    if board.is_game_over():
        return {"game_over": True, "result": board.result()}

    move, confidence = predict_move(board)
    if move is None:
        raise HTTPException(status_code=500, detail="no legal move resolved")

    san = board.san(move)
    board.push(move)

    return {
        "move_uci": move.uci(),
        "move_san": san,
        "confidence": confidence,
        "fen_after": board.fen(),
        "game_over": board.is_game_over(),
    }


@app.get("/health")
def health():
    return {"status": "ok", "device": str(device)}
