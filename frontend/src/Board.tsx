import { useEffect, useState } from 'react'
import type { Square } from 'chess.js'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

const PIECE_GLYPHS: Record<string, string> = {
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
}

interface PieceInfo {
  type: string
  color: string
}

interface BoardProps {
  board: (PieceInfo | null)[][]
  flipped: boolean
  draggable?: boolean
  onSquareClick?: (square: Square) => void
  onPieceDrop?: (from: Square, to: Square) => void
  lastMove?: { from: string; to: string }
  suggestion?: { from: string; to: string; piece: PieceInfo } | null
}

function Piece({ piece, ghost }: { piece: PieceInfo; ghost?: boolean }) {
  return (
    <span
      className={piece.color === 'w' ? 'piece-white' : 'piece-black'}
      style={{ opacity: ghost ? 0.45 : 1 }}
    >
      {PIECE_GLYPHS[piece.type]}
    </span>
  )
}

export default function Board({
  board,
  flipped,
  draggable,
  onSquareClick,
  onPieceDrop,
  lastMove,
  suggestion,
}: BoardProps) {
  const [dragFrom, setDragFrom] = useState<Square | null>(null)

  useEffect(() => {
    if (!dragFrom) return
    const clear = () => setDragFrom(null)
    window.addEventListener('mouseup', clear)
    return () => window.removeEventListener('mouseup', clear)
  }, [dragFrom])

  const ranks = flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  const files = flipped ? [...FILES].reverse() : FILES

  function handleMouseDown(square: Square, hasPiece: boolean) {
    if (draggable && hasPiece) setDragFrom(square)
  }

  function handleMouseUp(square: Square) {
    if (dragFrom && onPieceDrop && dragFrom !== square) {
      onPieceDrop(dragFrom, square)
    }
    setDragFrom(null)
  }

  return (
    <div
      className="inline-block border border-neutral-400"
      onMouseLeave={() => setDragFrom(null)}
    >
      {ranks.map((rankIdx) => (
        <div key={rankIdx} className="flex">
          {files.map((file, fileIdx) => {
            const actualFileIdx = flipped ? 7 - fileIdx : fileIdx
            const square = `${file}${rankIdx + 1}` as Square
            const piece = board[rankIdx][actualFileIdx]
            const isDark = (rankIdx + actualFileIdx) % 2 === 0
            const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square)
            const isSuggestionFrom = suggestion && suggestion.from === square
            const isSuggestionTo = suggestion && suggestion.to === square
            const isDragSource = dragFrom === square

            return (
              <div
                key={square}
                onMouseDown={() => handleMouseDown(square, !!piece)}
                onMouseUp={() => handleMouseUp(square)}
                onClick={() => onSquareClick?.(square)}
                className={`w-24 h-24 flex items-center justify-center text-7xl select-none relative
                  ${isDark ? 'bg-[#b58863]' : 'bg-[#f0d9b5]'}
                  ${draggable && piece ? 'cursor-grab active:cursor-grabbing' : ''}
                  ${isLastMove ? 'ring-4 ring-inset ring-yellow-400' : ''}
                  ${isSuggestionFrom ? 'ring-4 ring-inset ring-sky-500' : ''}
                  ${isSuggestionTo ? 'ring-4 ring-inset ring-sky-400' : ''}`}
              >
                {piece && (
                  <div style={{ opacity: isDragSource ? 0.4 : 1 }}>
                    <Piece piece={piece} />
                  </div>
                )}
                {isSuggestionTo && suggestion && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Piece piece={suggestion.piece} ghost />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
