import { Chess } from 'chess.js'
import type { Color, PieceSymbol, Square } from 'chess.js'
import { useEffect, useMemo, useState } from 'react'
import { fetchNextMove } from './api'
import Board from './Board'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const PALETTE: { type: PieceSymbol; color: Color }[] = [
  { type: 'k', color: 'b' }, { type: 'q', color: 'b' }, { type: 'r', color: 'b' },
  { type: 'b', color: 'b' }, { type: 'n', color: 'b' }, { type: 'p', color: 'b' },
  { type: 'k', color: 'w' }, { type: 'q', color: 'w' }, { type: 'r', color: 'w' },
  { type: 'b', color: 'w' }, { type: 'n', color: 'w' }, { type: 'p', color: 'w' },
]

type Mode = 'setup' | 'auto' | 'free'

interface HistoryEntry {
  fen: string
  san?: string
  confidence?: number
  lastMove?: { from: string; to: string }
}

interface Suggestion {
  from: Square
  to: Square
  piece: { type: string; color: string }
}

export default function App() {
  const [mode, setMode] = useState<Mode>('setup')
  const [history, setHistory] = useState<HistoryEntry[]>([{ fen: START_FEN }])
  const [index, setIndex] = useState(0)
  const [freeFen, setFreeFen] = useState(START_FEN)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [selectedPiece, setSelectedPiece] = useState<{ type: PieceSymbol; color: Color } | 'erase' | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [sideOverride, setSideOverride] = useState<Color | null>(null)
  const [fenInput, setFenInput] = useState(START_FEN)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const liveFen = mode === 'free' ? freeFen : history[index].fen
  const atFrontier = index === history.length - 1
  const lastMove = mode === 'free' ? undefined : history[index].lastMove
  const sanInfo = mode === 'free' ? undefined : history[index]

  const game = useMemo(() => {
    const g = new Chess()
    g.load(liveFen, { skipValidation: true })
    return g
  }, [liveFen])

  const effectiveSide = sideOverride ?? game.turn()

  useEffect(() => {
    setFenInput(liveFen)
  }, [liveFen])

  function applyFen(fen: string) {
    setHistory([{ fen }])
    setIndex(0)
    setFreeFen(fen)
    setFenInput(fen)
    setError(null)
    setSuggestion(null)
  }

  function handleSquareClick(square: Square) {
    if (mode !== 'setup') return
    const g = new Chess()
    g.load(liveFen, { skipValidation: true })
    if (selectedPiece === 'erase') {
      g.remove(square)
    } else if (selectedPiece) {
      g.put(selectedPiece, square)
    } else {
      return
    }
    const fen = g.fen()
    setHistory([{ fen }])
    setFreeFen(fen)
    setFenInput(fen)
  }

  function setBoardTurn(color: Color) {
    setSideOverride(color)
    const g = new Chess()
    g.load(liveFen, { skipValidation: true })
    const parts = g.fen().split(' ')
    parts[1] = color
    applyFen(parts.join(' '))
    setSideOverride(color)
  }

  function toggleCastling(letter: 'K' | 'Q' | 'k' | 'q') {
    const g = new Chess()
    g.load(liveFen, { skipValidation: true })
    const parts = g.fen().split(' ')
    let rights = parts[2] === '-' ? '' : parts[2]
    rights = rights.includes(letter) ? rights.replace(letter, '') : rights + letter
    const order = 'KQkq'
    rights = order.split('').filter((c) => rights.includes(c)).join('')
    parts[2] = rights || '-'
    applyFen(parts.join(' '))
  }

  function reset() {
    setMode('setup')
    setSideOverride(null)
    applyFen(START_FEN)
  }

  function kingsOnly() {
    setMode('setup')
    setSideOverride(null)
    applyFen('8/8/8/4k3/8/4K3/8/8 w - - 0 1')
  }

  async function requestAutoMove(fen: string) {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchNextMove(fen)
      if (result.game_over) {
        setError(result.result ? `game over, result ${result.result}` : 'game over, no legal moves')
        return
      }
      if (!result.fen_after || !result.move_uci) return
      const entry: HistoryEntry = {
        fen: result.fen_after,
        san: result.move_san,
        confidence: result.confidence,
        lastMove: { from: result.move_uci.slice(0, 2), to: result.move_uci.slice(2, 4) },
      }
      setHistory((prev) => [...prev.slice(0, index + 1), entry])
      setIndex((i) => i + 1)
      setSideOverride(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleAutoButton() {
    if (mode !== 'auto') {
      setMode('auto')
      setSuggestion(null)
    }
    if (atFrontier) {
      await requestAutoMove(liveFen)
    } else {
      setIndex((i) => i + 1)
    }
  }

  function handleBack() {
    if (index > 0) setIndex((i) => i - 1)
  }

  function startFreePlay() {
    setMode('free')
    setFreeFen(liveFen)
    setSuggestion(null)
  }

  async function handleFreeDrop(from: Square, to: Square) {
    const g = new Chess()
    g.load(freeFen, { skipValidation: true })
    const moved = g.get(from)
    if (!moved) return
    g.remove(from)
    g.remove(to)
    g.put(moved, to)
    const newFen = g.fen()
    setFreeFen(newFen)
    setSuggestion(null)

    const otherSide: Color = moved.color === 'w' ? 'b' : 'w'
    const parts = newFen.split(' ')
    parts[1] = otherSide
    const suggestionFen = parts.join(' ')

    setLoading(true)
    setError(null)
    try {
      const result = await fetchNextMove(suggestionFen)
      if (result.game_over || !result.move_uci) {
        setError(result.result ? `game over, result ${result.result}` : 'no move available')
        return
      }
      const from2 = result.move_uci.slice(0, 2) as Square
      const to2 = result.move_uci.slice(2, 4) as Square
      const sg = new Chess()
      sg.load(suggestionFen, { skipValidation: true })
      const piece = sg.get(from2)
      if (piece) {
        setSuggestion({ from: from2, to: to2, piece })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed')
    } finally {
      setLoading(false)
    }
  }

  const statusText = loading
    ? 'thinking'
    : error
      ? error
      : mode === 'free'
        ? suggestion
          ? 'suggestion shown for the other side'
          : 'move a piece, either side'
        : mode === 'auto'
          ? atFrontier
            ? 'ready for the next move'
            : 'viewing an earlier position'
          : 'set up a position, then press auto or play'

  return (
    <div className="min-h-screen flex flex-col items-center gap-8 py-10 px-4">
      <h1 className="text-2xl font-semibold">chess analysis board</h1>
      <div className="flex flex-col lg:flex-row gap-10">
        <div>
          {mode === 'setup' && (
            <div className="flex gap-1 mb-3 items-center">
              {PALETTE.map((p) => (
                <button
                  key={`${p.color}${p.type}`}
                  onClick={() => setSelectedPiece(p)}
                  className={`w-9 h-9 text-2xl border ${
                    selectedPiece !== 'erase' && selectedPiece?.type === p.type && selectedPiece?.color === p.color
                      ? 'border-blue-500'
                      : 'border-neutral-300'
                  }`}
                >
                  {p.color === 'w' ? p.type.toUpperCase() : p.type}
                </button>
              ))}
              <button
                onClick={() => setSelectedPiece('erase')}
                className={`w-9 h-9 border ${selectedPiece === 'erase' ? 'border-blue-500' : 'border-neutral-300'}`}
              >
                x
              </button>
            </div>
          )}
          <Board
            board={game.board()}
            flipped={flipped}
            draggable={mode === 'free'}
            onSquareClick={handleSquareClick}
            onPieceDrop={mode === 'free' ? handleFreeDrop : undefined}
            lastMove={lastMove}
            suggestion={suggestion}
          />
        </div>

        <div className="w-80 flex flex-col gap-4">
          <div className="text-sm text-neutral-600">{statusText}</div>

          <div className="flex gap-2">
            <button
              onClick={handleAutoButton}
              disabled={loading || mode === 'free'}
              className="px-4 py-2 bg-blue-600 text-white disabled:opacity-50"
            >
              {mode === 'auto' ? 'move' : 'auto'}
            </button>
            {mode === 'auto' && (
              <button
                onClick={handleBack}
                disabled={index === 0}
                className="px-4 py-2 border border-neutral-400 disabled:opacity-50"
              >
                back
              </button>
            )}
            {mode !== 'free' && (
              <button
                onClick={startFreePlay}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 text-white disabled:opacity-50"
              >
                play
              </button>
            )}
          </div>

          {sanInfo?.san && (
            <div className="text-sm">
              last move <span className="font-mono">{sanInfo.san}</span>
              {sanInfo.confidence !== undefined && ` at ${(sanInfo.confidence * 100).toFixed(0)}% confidence`}
            </div>
          )}

          <div>
            <div className="text-sm text-neutral-600 mb-1">side to move</div>
            <div className="flex gap-2">
              <button
                onClick={() => setBoardTurn('w')}
                className={`px-3 py-1 border ${effectiveSide === 'w' ? 'border-blue-500' : 'border-neutral-300'}`}
              >
                white
              </button>
              <button
                onClick={() => setBoardTurn('b')}
                className={`px-3 py-1 border ${effectiveSide === 'b' ? 'border-blue-500' : 'border-neutral-300'}`}
              >
                black
              </button>
            </div>
          </div>

          <div>
            <div className="text-sm text-neutral-600 mb-1">castling</div>
            <div className="flex gap-2">
              {(['K', 'Q', 'k', 'q'] as const).map((letter) => (
                <button
                  key={letter}
                  onClick={() => toggleCastling(letter)}
                  className={`w-8 h-8 border ${
                    liveFen.split(' ')[2]?.includes(letter) ? 'border-blue-500' : 'border-neutral-300'
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={reset} className="px-3 py-1 border border-neutral-400">reset</button>
            <button onClick={kingsOnly} className="px-3 py-1 border border-neutral-400">kings only</button>
            <button onClick={() => setFlipped((f) => !f)} className="px-3 py-1 border border-neutral-400">rotate</button>
          </div>

          <div>
            <div className="text-sm text-neutral-600 mb-1">fen</div>
            <input
              value={fenInput}
              onChange={(e) => setFenInput(e.target.value)}
              onBlur={() => {
                try {
                  const g = new Chess()
                  g.load(fenInput)
                  setMode('setup')
                  applyFen(fenInput)
                } catch {
                  setFenInput(liveFen)
                }
              }}
              className="w-full border border-neutral-300 px-2 py-1 text-xs font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
