import type { File, Language, Rank } from '../types'

type TokenMap<T extends string> = Record<string, T>

const FILE_TOKENS_EN: TokenMap<File> = {
  a: 'a',
  alpha: 'a',
  ay: 'a',
  hay: 'a',
  eh: 'a',
  b: 'b',
  bee: 'b',
  be: 'b',
  bravo: 'b',
  c: 'c',
  see: 'c',
  sea: 'c',
  cee: 'c',
  charlie: 'c',
  d: 'd',
  dee: 'd',
  delta: 'd',
  e: 'e',
  echo: 'e',
  f: 'f',
  ef: 'f',
  eff: 'f',
  foxtrot: 'f',
  g: 'g',
  gee: 'g',
  golf: 'g',
  h: 'h',
  aitch: 'h',
  hotel: 'h',
  age: 'h',
}

const FILE_TOKENS_FR: TokenMap<File> = {
  a: 'a',
  b: 'b',
  bé: 'b',
  be: 'b',
  c: 'c',
  cé: 'c',
  ce: 'c',
  sé: 'c',
  se: 'c',
  d: 'd',
  dé: 'd',
  de: 'd',
  e: 'e',
  eu: 'e',
  heu: 'e',
  f: 'f',
  effe: 'f',
  èfe: 'f',
  ef: 'f',
  g: 'g',
  gé: 'g',
  ge: 'g',
  ji: 'g',
  h: 'h',
  ache: 'h',
  hache: 'h',
}

const RANK_TOKENS_EN: TokenMap<Rank> = {
  '1': '1',
  one: '1',
  won: '1',
  '2': '2',
  two: '2',
  too: '2',
  '3': '3',
  three: '3',
  '4': '4',
  four: '4',
  for: '4',
  '5': '5',
  five: '5',
  '6': '6',
  six: '6',
  '7': '7',
  seven: '7',
  '8': '8',
  eight: '8',
  ate: '8',
}

const RANK_TOKENS_FR: TokenMap<Rank> = {
  '1': '1',
  un: '1',
  une: '1',
  '2': '2',
  deux: '2',
  '3': '3',
  trois: '3',
  '4': '4',
  quatre: '4',
  '5': '5',
  cinq: '5',
  cinque: '5',
  '6': '6',
  six: '6',
  '7': '7',
  sept: '7',
  '8': '8',
  huit: '8',
}

export const RESET_TOKENS_EN = new Set(['reset', 'restart', 'new', 'newgame'])
export const RESET_TOKENS_FR = new Set(['recommencer', 'reset', 'nouvelle', 'restart'])

export interface Dictionary {
  files: TokenMap<File>
  ranks: TokenMap<Rank>
  reset: Set<string>
}

export function getDictionary(lang: Language): Dictionary {
  if (lang === 'fr') return { files: FILE_TOKENS_FR, ranks: RANK_TOKENS_FR, reset: RESET_TOKENS_FR }
  return { files: FILE_TOKENS_EN, ranks: RANK_TOKENS_EN, reset: RESET_TOKENS_EN }
}

const COMBINED_RE = /^([a-h])\s?([1-8])$/i

export function splitCompound(token: string): string[] {
  const m = COMBINED_RE.exec(token)
  if (m?.[1] && m[2]) return [m[1], m[2]]
  return [token]
}
