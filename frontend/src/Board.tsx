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
  const [dragPiece, setDragPiece] = useState<PieceInfo | null>(null)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!dragFrom) return
    const move = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY })
    const clear = () => {
      setDragFrom(null)
      setDragPiece(null)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', clear)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', clear)
    }
  }, [dragFrom])

  const ranks = flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  const files = flipped ? [...FILES].reverse() : FILES

  function handleMouseDown(e: React.MouseEvent, square: Square, piece: PieceInfo | null) {
    if (!draggable || !piece) return
    setDragFrom(square)
    setDragPiece(piece)
    setCursor({ x: e.clientX, y: e.clientY })
  }

  function handleMouseUp(square: Square) {
    if (dragFrom && onPieceDrop && dragFrom !== square) {
      onPieceDrop(dragFrom, square)
    }
    setDragFrom(null)
    setDragPiece(null)
  }

  return (
    <>
      {dragPiece && (
        <div
          className="fixed pointer-events-none z-50 text-7xl"
          style={{ left: cursor.x - 48, top: cursor.y - 48 }}
        >
          <Piece piece={dragPiece} />
        </div>
      )}
      <div className="inline-block">
        <div className="inline-block border border-neutral-400">
          {ranks.map((rankIdx) => (
            <div key={rankIdx} className="flex">
              <div className="w-6 h-24 flex items-center justify-center text-sm text-neutral-600">
                {rankIdx + 1}
              </div>
              {files.map((file, fileIdx) => {
                const actualFileIdx = flipped ? 7 - fileIdx : fileIdx
                const square = `${file}${rankIdx + 1}` as Square
                const piece = board[7 - rankIdx][actualFileIdx]
                const isDark = (rankIdx + actualFileIdx) % 2 === 0
                const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square)
                const isSuggestionFrom = suggestion && suggestion.from === square
                const isSuggestionTo = suggestion && suggestion.to === square
                const isDragSource = dragFrom === square

                return (
                  <div
                    key={square}
                    onMouseDown={(e) => handleMouseDown(e, square, piece)}
                    onMouseUp={() => handleMouseUp(square)}
                    onClick={() => onSquareClick?.(square)}
                    className={`w-24 h-24 flex items-center justify-center text-7xl select-none relative
                      ${isDark ? 'bg-[#b58863]' : 'bg-[#f0d9b5]'}
                      ${draggable && piece ? 'cursor-grab active:cursor-grabbing' : ''}
                      ${isLastMove ? 'ring-4 ring-inset ring-yellow-400' : ''}
                      ${isSuggestionFrom ? 'ring-4 ring-inset ring-sky-500' : ''}
                      ${isSuggestionTo ? 'ring-4 ring-inset ring-sky-400' : ''}`}
                  >
                    {piece && !isDragSource && <Piece piece={piece} />}
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
        <div className="flex">
          <div className="w-6" />
          {files.map((file) => (
            <div key={file} className="w-24 text-center text-sm text-neutral-600 pt-1">
              {file}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
