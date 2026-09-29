import chess
import numpy as np

PIECE_ORDER = [
    chess.PAWN,
    chess.KNIGHT,
    chess.BISHOP,
    chess.ROOK,
    chess.QUEEN,
    chess.KING,
]

NUM_PLANES = 18
MOVE_CLASSES = 64 * 64


def board_to_tensor(board):
    planes = np.zeros((NUM_PLANES, 8, 8), dtype=np.float32)

    for square, piece in board.piece_map().items():
        rank = chess.square_rank(square)
        file = chess.square_file(square)
        piece_index = PIECE_ORDER.index(piece.piece_type)
        color_offset = 0 if piece.color == chess.WHITE else 6
        planes[piece_index + color_offset, rank, file] = 1.0

    side_plane = 12
    planes[side_plane, :, :] = 1.0 if board.turn == chess.WHITE else 0.0

    castling_planes = 13
    planes[castling_planes + 0, :, :] = 1.0 if board.has_kingside_castling_rights(chess.WHITE) else 0.0
    planes[castling_planes + 1, :, :] = 1.0 if board.has_queenside_castling_rights(chess.WHITE) else 0.0
    planes[castling_planes + 2, :, :] = 1.0 if board.has_kingside_castling_rights(chess.BLACK) else 0.0
    planes[castling_planes + 3, :, :] = 1.0 if board.has_queenside_castling_rights(chess.BLACK) else 0.0

    ep_plane = 17
    if board.ep_square is not None:
        rank = chess.square_rank(board.ep_square)
        file = chess.square_file(board.ep_square)
        planes[ep_plane, rank, file] = 1.0

    return planes


def move_to_class(move):
    return move.from_square * 64 + move.to_square


def class_to_from_to(class_index):
    from_square = class_index // 64
    to_square = class_index % 64
    return from_square, to_square


def legal_move_mask(board):
    mask = np.zeros(MOVE_CLASSES, dtype=np.float32)
    for move in board.legal_moves:
        mask[move_to_class(move)] = 1.0
    return mask


def resolve_predicted_move(board, class_index):
    from_square, to_square = class_to_from_to(class_index)
    for move in board.legal_moves:
        if move.from_square == from_square and move.to_square == to_square:
            if move.promotion is not None and move.promotion != chess.QUEEN:
                continue
            return move
    for move in board.legal_moves:
        if move.from_square == from_square and move.to_square == to_square:
            return move
    return None
