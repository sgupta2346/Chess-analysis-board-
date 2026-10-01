import chess
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from move_source import MoveSource

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

source = MoveSource()


class PositionRequest(BaseModel):
    fen: str


@app.post("/next-move")
def next_move(body: PositionRequest):
    try:
        board = chess.Board(body.fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid fen")

    if board.is_game_over():
        return {"game_over": True, "result": board.result()}

    move, elo, escalated = source.choose_move(board)
    if move is None:
        raise HTTPException(status_code=500, detail="no legal move resolved")

    san = board.san(move)
    board.push(move)

    return {
        "move_uci": move.uci(),
        "move_san": san,
        "elo": elo,
        "escalated": escalated,
        "fen_after": board.fen(),
        "game_over": board.is_game_over(),
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.on_event("shutdown")
def shutdown():
    source.close()
