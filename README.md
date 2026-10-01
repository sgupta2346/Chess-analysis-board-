# Chess Analysis Board

Set up any position on the board and it suggests the next move, playing at roughly a 2300 rating. Every suggested move is checked against a full strength analysis before it's shown, so it won't hand you an outright blunder.

## How it works

A chess engine runs in two modes. One pass generates the actual move, configured to play at approximately 2300 strength through a built in rating limiter. Before that move is shown, a second, full strength pass checks it isn't a real blunder, hanging a piece or missing a forced loss, and if it is, the system tries again at the same strength or a bit higher until it finds one that holds up.

`src/move_source.py` has that logic. `src/api.py` serves it over a small FastAPI endpoint. `frontend/` is the board itself, set up a position by placing pieces or editing the FEN directly, drag pieces around freely with no legality checking, or step through suggested moves one at a time for either side.

## Running it

Backend:
```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd src
uvicorn api:app --reload --port 8130
```

Frontend:
```
cd frontend
npm install
npm run dev
```
