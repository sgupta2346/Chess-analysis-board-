import type { Square } from 'chess.js'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

const PIECE_GLYPHS: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
}

interface BoardProps {
  board: ({ type: string; color: string } | null)[][]
  flipped: boolean
  onSquareClick: (square: Square) => void
  lastMove?: { from: string; to: string }
}

export default function Board({ board, flipped, onSquareClick, lastMove }: BoardProps) {
  const ranks = flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  const files = flipped ? [...FILES].reverse() : FILES

  return (
    <div className="inline-block border border-neutral-400">
      {ranks.map((rankIdx) => (
        <div key={rankIdx} className="flex">
          {files.map((file, fileIdx) => {
            const actualFileIdx = flipped ? 7 - fileIdx : fileIdx
            const square = `${file}${rankIdx + 1}` as Square
            const piece = board[rankIdx][actualFileIdx]
            const isDark = (rankIdx + actualFileIdx) % 2 === 0
            const isHighlighted = lastMove && (lastMove.from === square || lastMove.to === square)

            return (
              <button
                key={square}
                onClick={() => onSquareClick(square)}
                className={`w-16 h-16 flex items-center justify-center text-4xl select-none
                  ${isDark ? 'bg-[#b58863]' : 'bg-[#f0d9b5]'}
                  ${isHighlighted ? 'ring-4 ring-inset ring-yellow-400' : ''}`}
              >
                {piece ? PIECE_GLYPHS[`${piece.color}${piece.type}`] : ''}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
