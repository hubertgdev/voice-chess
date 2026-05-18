export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'
export type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'
export type Square = `${File}${Rank}`

export const FILES: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
export const RANKS: Rank[] = ['1', '2', '3', '4', '5', '6', '7', '8']

export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export interface PieceOn {
  type: PieceType
  color: Color
  square: Square
}

export type Language = 'en' | 'fr'

export interface ParsedMove {
  from: Square
  to: Square
}
