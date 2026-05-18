import type { File, Language, ParsedMove, Rank, Square } from '../types'
import { getDictionary, splitCompound } from './dictionary'

export type ParseOutcome =
  | { kind: 'move'; move: ParsedMove }
  | { kind: 'square'; square: Square }
  | { kind: 'reset' }
  | { kind: 'incomplete'; partial: string[] }
  | { kind: 'unknown'; raw: string }

export function parseUtterance(raw: string, lang: Language): ParseOutcome {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return { kind: 'unknown', raw }

  const dict = getDictionary(lang)
  const rawTokens = trimmed
    .replace(/[.,;!?'‘’`]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((t) => splitCompound(t))

  for (const t of rawTokens) {
    if (dict.reset.has(t)) return { kind: 'reset' }
  }

  const sequence: (File | Rank)[] = []
  let expectFile = true

  for (const token of rawTokens) {
    if (expectFile) {
      const f = dict.files[token]
      if (f !== undefined) {
        sequence.push(f)
        expectFile = false
        if (sequence.length === 4) break
      }
    } else {
      const r = dict.ranks[token]
      if (r !== undefined) {
        sequence.push(r)
        expectFile = true
        if (sequence.length === 4) break
      }
    }
  }

  if (sequence.length === 4) {
    const from = `${sequence[0]}${sequence[1]}` as Square
    const to = `${sequence[2]}${sequence[3]}` as Square
    return { kind: 'move', move: { from, to } }
  }

  if (sequence.length === 2) {
    const square = `${sequence[0]}${sequence[1]}` as Square
    return { kind: 'square', square }
  }

  if (sequence.length === 0) return { kind: 'unknown', raw }
  return { kind: 'incomplete', partial: sequence }
}
