import gsap from 'gsap'
import { Application, Container, Graphics, Text } from 'pixi.js'
import type { PieceOn, Square } from '../types'
import { FILES, RANKS } from '../types'
import { pieceGlyph } from './pieces'

const SQUARE_SIZE = 72
const MARGIN = 24
const BOARD_PX = SQUARE_SIZE * 8
const CANVAS_PX = BOARD_PX + MARGIN * 2

const COLOR_LIGHT = 0xf0d9b5
const COLOR_DARK = 0xb58863
const COLOR_SELECT = 0xf6f669
const COLOR_LAST_MOVE = 0xcdd26a
const COLOR_LEGAL_DOT = 0x000000
const COLOR_CHECK = 0xff5b5b
const COLOR_BG = 0x312e2b
const COLOR_TEXT = 0xeeeeee

interface Highlights {
  selected: Square | null
  legal: Square[]
  lastMove: { from: Square; to: Square } | null
  check: Square | null
}

export class BoardView {
  readonly app: Application
  private boardLayer = new Container()
  private highlightLayer = new Container()
  private legalLayer = new Container()
  private pieceLayer = new Container()
  private sprites = new Map<Square, Text>()
  private onSquareClick: ((sq: Square) => void) | null = null
  private highlights: Highlights = {
    selected: null,
    legal: [],
    lastMove: null,
    check: null,
  }

  constructor() {
    this.app = new Application()
  }

  async init(parent: HTMLElement): Promise<void> {
    await this.app.init({
      width: CANVAS_PX,
      height: CANVAS_PX,
      background: COLOR_BG,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    parent.appendChild(this.app.canvas)
    this.app.canvas.style.borderRadius = '8px'
    this.app.canvas.style.display = 'block'
    this.app.canvas.style.maxWidth = '100%'
    this.app.canvas.style.height = 'auto'

    this.boardLayer.position.set(MARGIN, MARGIN)
    this.highlightLayer.position.set(MARGIN, MARGIN)
    this.legalLayer.position.set(MARGIN, MARGIN)
    this.pieceLayer.position.set(MARGIN, MARGIN)
    this.app.stage.addChild(this.boardLayer)
    this.app.stage.addChild(this.highlightLayer)
    this.app.stage.addChild(this.pieceLayer)
    this.app.stage.addChild(this.legalLayer)

    this.drawSquares()
    this.drawCoordinates()
    this.drawHighlights()
  }

  setOnSquareClick(handler: (sq: Square) => void): void {
    this.onSquareClick = handler
  }

  setHighlights(h: Partial<Highlights>): void {
    this.highlights = { ...this.highlights, ...h }
    this.drawHighlights()
  }

  setPieces(pieces: PieceOn[]): void {
    const target = new Map(pieces.map((p) => [p.square, p] as const))
    for (const [sq, sprite] of this.sprites) {
      if (!target.has(sq)) {
        sprite.destroy()
        this.sprites.delete(sq)
      }
    }
    for (const piece of pieces) {
      const existing = this.sprites.get(piece.square)
      const desiredGlyph = pieceGlyph(piece.color, piece.type)
      if (existing && existing.text === desiredGlyph) continue
      if (existing) {
        existing.destroy()
        this.sprites.delete(piece.square)
      }
      this.sprites.set(piece.square, this.createSprite(piece))
    }
  }

  animateMove(from: Square, to: Square, pieces: PieceOn[]): Promise<void> {
    return new Promise((resolve) => {
      const sprite = this.sprites.get(from)
      if (!sprite) {
        this.setPieces(pieces)
        resolve()
        return
      }
      const captured = this.sprites.get(to)
      const target = squareToPixel(to)
      this.sprites.delete(from)
      const previousAt = this.sprites.get(to)
      if (previousAt) {
        previousAt.destroy()
      }
      this.sprites.set(to, sprite)

      if (captured) {
        gsap.to(captured, {
          alpha: 0,
          duration: 0.18,
          onComplete: () => captured.destroy(),
        })
      }
      gsap.to(sprite, {
        x: target.x + SQUARE_SIZE / 2,
        y: target.y + SQUARE_SIZE / 2,
        duration: 0.22,
        ease: 'power2.out',
        onComplete: () => {
          this.setPieces(pieces)
          resolve()
        },
      })
    })
  }

  destroy(): void {
    this.app.destroy(true, { children: true })
  }

  private createSprite(piece: PieceOn): Text {
    const sprite = new Text({
      text: pieceGlyph(piece.color, piece.type),
      style: {
        fontFamily: 'serif',
        fontSize: SQUARE_SIZE * 0.78,
        fill: piece.color === 'w' ? 0xffffff : 0x111111,
        stroke: {
          color: piece.color === 'w' ? 0x111111 : 0xdddddd,
          width: 2,
          join: 'round',
        },
        align: 'center',
      },
    })
    sprite.anchor.set(0.5)
    const { x, y } = squareToPixel(piece.square)
    sprite.x = x + SQUARE_SIZE / 2
    sprite.y = y + SQUARE_SIZE / 2
    this.pieceLayer.addChild(sprite)
    return sprite
  }

  private drawSquares(): void {
    this.boardLayer.removeChildren()
    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        const file = FILES[f]
        const rank = RANKS[r]
        if (!file || !rank) continue
        const sq = `${file}${rank}` as Square
        const isLight = (f + r) % 2 === 1
        const g = new Graphics().rect(0, 0, SQUARE_SIZE, SQUARE_SIZE).fill(isLight ? COLOR_LIGHT : COLOR_DARK)
        const { x, y } = squareToPixel(sq)
        g.x = x
        g.y = y
        g.eventMode = 'static'
        g.cursor = 'pointer'
        g.on('pointertap', () => this.onSquareClick?.(sq))
        this.boardLayer.addChild(g)
      }
    }
  }

  private drawCoordinates(): void {
    const stage = this.app.stage
    const labelStyle = { fontFamily: 'sans-serif', fontSize: 13, fill: COLOR_TEXT }
    for (let f = 0; f < 8; f++) {
      const fileLabel = FILES[f]
      if (!fileLabel) continue
      const t = new Text({ text: fileLabel, style: labelStyle })
      t.anchor.set(0.5)
      t.x = MARGIN + f * SQUARE_SIZE + SQUARE_SIZE / 2
      t.y = MARGIN + BOARD_PX + 12
      stage.addChild(t)
    }
    for (let r = 0; r < 8; r++) {
      const rankLabel = (8 - r).toString()
      const t = new Text({ text: rankLabel, style: labelStyle })
      t.anchor.set(0.5)
      t.x = MARGIN / 2
      t.y = MARGIN + r * SQUARE_SIZE + SQUARE_SIZE / 2
      stage.addChild(t)
    }
  }

  private drawHighlights(): void {
    this.highlightLayer.removeChildren()
    this.legalLayer.removeChildren()

    const { selected, legal, lastMove, check } = this.highlights

    if (lastMove) {
      for (const sq of [lastMove.from, lastMove.to]) {
        const { x, y } = squareToPixel(sq)
        const g = new Graphics().rect(0, 0, SQUARE_SIZE, SQUARE_SIZE).fill({ color: COLOR_LAST_MOVE, alpha: 0.55 })
        g.x = x
        g.y = y
        this.highlightLayer.addChild(g)
      }
    }
    if (selected) {
      const { x, y } = squareToPixel(selected)
      const g = new Graphics().rect(0, 0, SQUARE_SIZE, SQUARE_SIZE).fill({ color: COLOR_SELECT, alpha: 0.55 })
      g.x = x
      g.y = y
      this.highlightLayer.addChild(g)
    }
    if (check) {
      const { x, y } = squareToPixel(check)
      const g = new Graphics().rect(0, 0, SQUARE_SIZE, SQUARE_SIZE).fill({ color: COLOR_CHECK, alpha: 0.55 })
      g.x = x
      g.y = y
      this.highlightLayer.addChild(g)
    }
    for (const sq of legal) {
      const { x, y } = squareToPixel(sq)
      const g = new Graphics()
        .circle(SQUARE_SIZE / 2, SQUARE_SIZE / 2, SQUARE_SIZE * 0.16)
        .fill({ color: COLOR_LEGAL_DOT, alpha: 0.2 })
      g.x = x
      g.y = y
      this.legalLayer.addChild(g)
    }
  }
}

function squareToPixel(sq: Square): { x: number; y: number } {
  const file = sq[0] as (typeof FILES)[number]
  const rank = sq[1] as (typeof RANKS)[number]
  const f = FILES.indexOf(file)
  const r = 8 - parseInt(rank, 10)
  return { x: f * SQUARE_SIZE, y: r * SQUARE_SIZE }
}
