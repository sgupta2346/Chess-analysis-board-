# Chess Move Predictor

Given any position, predicts the move a real human player rated 2000 to 2300
would actually play next, not the objectively strongest move. Trained on
real rated games from Lichess's public database.

Work in progress, building this up stage by stage.

## Stages

- [ ] Data pipeline, filter Lichess games to the 2000 to 2300 rating band
- [ ] Model, trained on real human moves from that band
- [ ] Evaluation, move matching accuracy plus real game outcomes
- [ ] Board interface and API
