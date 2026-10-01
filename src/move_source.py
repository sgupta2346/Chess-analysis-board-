import os

import chess.engine

ENGINE_PATH = os.environ.get(
    "STOCKFISH_PATH",
    os.path.join(os.path.dirname(__file__), "..", "engine", "stockfish", "stockfish-windows-x86-64-universal.exe"),
)
ANALYSIS_DEPTH = 10
MATE_SCORE = 100000
BLUNDER_THRESHOLD_CP = 300
PLAY_TIME = 0.5
TARGET_ELO = 2350
ELO_RETRY_STEPS = [2350, 2350, 2350, 2400, 2400, 2600, 3190]


class MoveSource:
    def __init__(self, engine_path=ENGINE_PATH):
        self.engine = chess.engine.SimpleEngine.popen_uci(engine_path)

    def _eval_cp(self, board, pov):
        self.engine.configure({"UCI_LimitStrength": False})
        info = self.engine.analyse(board, chess.engine.Limit(depth=ANALYSIS_DEPTH))
        return info["score"].pov(pov).score(mate_score=MATE_SCORE)

    def _move_loss_cp(self, board, move):
        mover = board.turn
        before = self._eval_cp(board, mover)
        board.push(move)
        after = self._eval_cp(board, mover)
        board.pop()
        return before - after

    def _play_at_elo(self, board, elo):
        self.engine.configure({"UCI_LimitStrength": True, "UCI_Elo": elo})
        result = self.engine.play(board, chess.engine.Limit(time=PLAY_TIME))
        return result.move

    def choose_move(self, board):
        for elo in ELO_RETRY_STEPS:
            move = self._play_at_elo(board, elo)
            loss = self._move_loss_cp(board, move)
            if loss <= BLUNDER_THRESHOLD_CP:
                return move, elo, elo > TARGET_ELO
        self.engine.configure({"UCI_LimitStrength": False})
        result = self.engine.play(board, chess.engine.Limit(depth=ANALYSIS_DEPTH))
        return result.move, None, True

    def close(self):
        self.engine.quit()
