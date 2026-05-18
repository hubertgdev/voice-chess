import { Chess } from 'chess.js'
import type { Color, PieceOn, Square } from '../types'

export interface MoveResult {
  ok: boolean
  san?: string
  capture?: boolean
  castle?: 'k' | 'q'
  promotion?: boolean
  error?: string
}

export interface GameStatus {
  turn: Color
  inCheck: boolean
  checkmate: boolean
  stalemate: boolean
  draw: boolean
  gameOver: boolean
  winner: Color | null
}

export class ChessEngine {
  private chess = new Chess()

  reset(): void {
    this.chess.reset()
  }

  pieces(): PieceOn[] {
    const out: PieceOn[] = []
    const board = this.chess.board()
    for (let r = 0; r < 8; r++) {
      const row = board[r]
      if (!row) continue
      for (let f = 0; f < 8; f++) {
        const cell = row[f]
        if (!cell) continue
        const file = 'abcdefgh'[f] as Square[0]
        const rank = (8 - r).toString() as Square[1]
        out.push({ type: cell.type, color: cell.color, square: `${file}${rank}` as Square })
      }
    }
    return out
  }

  pieceAt(square: Square): PieceOn | null {
    const p = this.chess.get(square)
    if (!p) return null
    return { type: p.type, color: p.color, square }
  }

  legalDestinations(from: Square): Square[] {
    const moves = this.chess.moves({ square: from, verbose: true })
    const set = new Set<Square>()
    for (const m of moves) set.add(m.to as Square)
    return [...set]
  }

  move(from: Square, to: Square): MoveResult {
    try {
      const move = this.chess.move({ from, to, promotion: 'q' })
      return {
        ok: true,
        san: move.san,
        capture: move.captured !== undefined,
        castle: move.flags.includes('k') ? 'k' : move.flags.includes('q') ? 'q' : undefined,
        promotion: move.promotion !== undefined,
      }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  status(): GameStatus {
    const turn = this.chess.turn()
    const checkmate = this.chess.isCheckmate()
    const stalemate = this.chess.isStalemate()
    const draw = this.chess.isDraw()
    const gameOver = this.chess.isGameOver()
    const inCheck = this.chess.isCheck()
    let winner: Color | null = null
    if (checkmate) winner = turn === 'w' ? 'b' : 'w'
    return { turn, inCheck, checkmate, stalemate, draw, gameOver, winner }
  }

  fen(): string {
    return this.chess.fen()
  }
}
