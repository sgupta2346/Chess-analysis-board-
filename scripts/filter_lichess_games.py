import argparse
import io
import json
import sys

import chess
import chess.pgn


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--min-rating", type=int, default=2000)
    p.add_argument("--max-rating", type=int, default=2300)
    p.add_argument("--target", type=int, default=500000)
    return p.parse_args()


def header_ratings(header_lines):
    white_elo = None
    black_elo = None
    for line in header_lines:
        if line.startswith("[WhiteElo "):
            try:
                white_elo = int(line.split('"')[1])
            except (IndexError, ValueError):
                pass
        elif line.startswith("[BlackElo "):
            try:
                black_elo = int(line.split('"')[1])
            except (IndexError, ValueError):
                pass
    return white_elo, black_elo


def process_game(header_lines, movetext_lines, min_rating, max_rating, out):
    white_elo, black_elo = header_ratings(header_lines)
    target_ratings = {}
    if white_elo is not None and min_rating <= white_elo <= max_rating:
        target_ratings[chess.WHITE] = white_elo
    if black_elo is not None and min_rating <= black_elo <= max_rating:
        target_ratings[chess.BLACK] = black_elo
    if not target_ratings:
        return 0

    game_text = "\n".join(header_lines) + "\n\n" + "\n".join(movetext_lines) + "\n"
    game = chess.pgn.read_game(io.StringIO(game_text))
    if game is None:
        return 0

    result = game.headers.get("Result", "*")
    board = game.board()
    count = 0
    for move in game.mainline_moves():
        if board.turn in target_ratings:
            record = {
                "fen": board.fen(),
                "move": move.uci(),
                "rating": target_ratings[board.turn],
                "result": result,
            }
            out.write(json.dumps(record))
            out.write("\n")
            count += 1
        board.push(move)
    return count


def main():
    args = parse_args()
    kept = 0
    games_seen = 0
    header_lines = []
    movetext_lines = []
    in_headers = True
    out = sys.stdout

    for raw_line in sys.stdin:
        line = raw_line.rstrip("\n")
        if line.startswith("[Event "):
            if header_lines or movetext_lines:
                games_seen += 1
                kept += process_game(header_lines, movetext_lines, args.min_rating, args.max_rating, out)
                if kept >= args.target:
                    print(f"games_seen={games_seen} kept_examples={kept} reason=target_reached", file=sys.stderr)
                    return
            header_lines = [line]
            movetext_lines = []
            in_headers = True
            continue
        if in_headers:
            if line.startswith("["):
                header_lines.append(line)
            elif line == "":
                in_headers = False
            continue
        movetext_lines.append(line)

    if header_lines or movetext_lines:
        games_seen += 1
        kept += process_game(header_lines, movetext_lines, args.min_rating, args.max_rating, out)

    print(f"games_seen={games_seen} kept_examples={kept} reason=end_of_input", file=sys.stderr)


if __name__ == "__main__":
    main()
