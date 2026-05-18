import { describe, expect, it } from 'vitest'
import { parseUtterance } from '../voice/parser'

describe('parseUtterance (English)', () => {
  it('parses "e2 e4"', () => {
    const r = parseUtterance('e2 e4', 'en')
    expect(r.kind).toBe('move')
    if (r.kind === 'move') expect(r.move).toEqual({ from: 'e2', to: 'e4' })
  })

  it('parses "e 2 to e 4"', () => {
    const r = parseUtterance('e 2 to e 4', 'en')
    expect(r.kind).toBe('move')
    if (r.kind === 'move') expect(r.move).toEqual({ from: 'e2', to: 'e4' })
  })

  it('parses "move e two to e four"', () => {
    const r = parseUtterance('move e two to e four', 'en')
    expect(r.kind).toBe('move')
    if (r.kind === 'move') expect(r.move).toEqual({ from: 'e2', to: 'e4' })
  })

  it('handles the "to/two" homophone in the middle', () => {
    const r = parseUtterance('e two two e four', 'en')
    expect(r.kind).toBe('move')
    if (r.kind === 'move') expect(r.move).toEqual({ from: 'e2', to: 'e4' })
  })

  it('handles phonetic letter spellings', () => {
    const r = parseUtterance('bee 1 see 3', 'en')
    expect(r.kind).toBe('move')
    if (r.kind === 'move') expect(r.move).toEqual({ from: 'b1', to: 'c3' })
  })

  it('handles NATO-ish alphabet', () => {
    const r = parseUtterance('alpha 7 alpha 8', 'en')
    expect(r.kind).toBe('move')
    if (r.kind === 'move') expect(r.move).toEqual({ from: 'a7', to: 'a8' })
  })

  it('recognises a reset command', () => {
    expect(parseUtterance('reset', 'en').kind).toBe('reset')
    expect(parseUtterance('start a new game', 'en').kind).toBe('reset')
  })

  it('returns incomplete when only half the move is heard', () => {
    const r = parseUtterance('e two', 'en')
    expect(r.kind).toBe('incomplete')
  })

  it('returns unknown for nonsense', () => {
    const r = parseUtterance('hello there friend', 'en')
    expect(r.kind).toBe('unknown')
  })
})

describe('parseUtterance (French)', () => {
  it('parses "e 2 à e 4"', () => {
    const r = parseUtterance('e 2 à e 4', 'fr')
    expect(r.kind).toBe('move')
    if (r.kind === 'move') expect(r.move).toEqual({ from: 'e2', to: 'e4' })
  })

  it('parses "déplace e deux à e quatre"', () => {
    const r = parseUtterance('déplace e deux à e quatre', 'fr')
    expect(r.kind).toBe('move')
    if (r.kind === 'move') expect(r.move).toEqual({ from: 'e2', to: 'e4' })
  })

  it('parses with French phonetic letters', () => {
    const r = parseUtterance('bé un cé trois', 'fr')
    expect(r.kind).toBe('move')
    if (r.kind === 'move') expect(r.move).toEqual({ from: 'b1', to: 'c3' })
  })

  it('recognises a French reset', () => {
    expect(parseUtterance('recommencer', 'fr').kind).toBe('reset')
  })
})
