# Chess Analysis Board

Set up any position and see the move a real human player rated 2000 to 2300 would actually play next, not the strongest move an engine would find. The model is trained on real rated games pulled from Lichess's public database, so its choices reflect how people at that level actually play, mistakes and all, rather than a weakened version of an engine.

## Results

Trained on 2,940,083 real moves played by 2000 to 2300 rated players on Lichess, with 60,001 held out for validation. Top 1 move matching accuracy against that held out set reached 41.8 percent after 6 epochs, up from 36.5 percent after the first. Training ran on a Kaggle GPU, about 8 minutes per epoch over the full dataset.

Move style has not yet been checked against a reference engine to confirm it stays in the target rating band rather than drifting toward stronger play, and the model has not yet been tested in actual games against opponents of known strength. Both are the next real step.

## How it works

`scripts/filter_lichess_games.py` streams a Lichess monthly dump through zstd and pulls out one training example per move made by a player rated 2000 to 2300, without ever holding the full decompressed file on disk. `src/model.py` is an 8 block residual CNN reading an 18 plane board encoding from `src/encoding.py`, trained to predict which move a player in that band actually made in a given position. `src/api.py` serves the trained model behind a FastAPI endpoint. `frontend/` is the board itself, set up a position by placing pieces or editing the FEN directly, then step through generated moves one at a time for either side.

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

Model weights are not committed to this repo. Run the data pipeline and training script to produce `models/move_predictor_v1.pt`, or the API will fail to start.
