import type { Color, PieceType } from '../types'

const GLYPHS: Record<Color, Record<PieceType, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
}

export function pieceGlyph(color: Color, type: PieceType): string {
  return GLYPHS[color][type]
}
