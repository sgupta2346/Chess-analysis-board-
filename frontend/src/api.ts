const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8130'

export interface NextMoveResponse {
  move_uci?: string
  move_san?: string
  elo?: number
  escalated?: boolean
  fen_after?: string
  game_over: boolean
  result?: string
}

export async function fetchNextMove(fen: string): Promise<NextMoveResponse> {
  const resp = await fetch(`${API_URL}/next-move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen }),
  })
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.detail || `request failed with status ${resp.status}`)
  }
  return resp.json()
}
