import gsap from 'gsap'
import { Application, Container, Graphics, Text } from 'pixi.js'
import type { PieceOn, Square } from '../types'
import { FILES, RANKS } from '../types'
import { pieceGlyph } from './pieces'

const SQUARE_SIZE = 72
const MARGIN = 24
const BOARD_PX = SQUARE_SIZE * 8
const CANVAS_PX = BOARD_PX + MARGIN * 2
const DRAG_THRESHOLD = 5

const COLOR_LIGHT = 0xf0d9b5
const COLOR_DARK = 0xb58863
const COLOR_SELECT = 0xf6f669
const COLOR_LAST_MOVE = 0x6e92c4
const COLOR_LEGAL_DOT = 0x000000
const COLOR_CHECK = 0xff5b5b
const COLOR_BG = 0x312e2b
const COLOR_TEXT = 0xeeeeee
const COLOR_HOVER = 0xffffff
const COLOR_HOVER_LEGAL = 0x7ed957

interface Highlights {
  selected: Square | null
  legal: Square[]
  lastMove: { from: Square; to: Square } | null
  check: Square | null
}

interface PointerSession {
  pointerId: number
  startSquare: Square | null
  startClientX: number
  startClientY: number
  drag: {
    from: Square
    sprite: Text
    originX: number
    originY: number
  } | null
}

export class BoardView {
  readonly app: Application
  private boardLayer = new Container()
  private highlightLayer = new Container()
  private legalLayer = new Container()
  private pieceLayer = new Container()
  private sprites = new Map<Square, Text>()
  private onSquareClick: ((sq: Square) => void) | null = null
  private onDragStart: ((from: Square) => boolean) | null = null
  private onDragEnd: ((from: Square, to: Square | null) => boolean) | null = null
  private highlights: Highlights = {
    selected: null,
    legal: [],
    lastMove: null,
    check: null,
  }
  private session: PointerSession | null = null
  private hoverSquare: Square | null = null
  private handlePointerDown = (e: PointerEvent) => this.onPointerDown(e)
  private handlePointerMove = (e: PointerEvent) => this.onPointerMove(e)
  private handlePointerUp = (e: PointerEvent) => this.onPointerUp(e)
  private handleCanvasLeave = () => this.clearHover()

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
    this.app.canvas.style.touchAction = 'none'

    this.boardLayer.position.set(MARGIN, MARGIN)
    this.highlightLayer.position.set(MARGIN, MARGIN)
    this.legalLayer.position.set(MARGIN, MARGIN)
    this.pieceLayer.position.set(MARGIN, MARGIN)
    this.app.stage.addChild(this.boardLayer)
    this.app.stage.addChild(this.highlightLayer)
    this.app.stage.addChild(this.pieceLayer)
    this.app.stage.addChild(this.legalLayer)

    this.app.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.app.canvas.addEventListener('pointerleave', this.handleCanvasLeave)
    window.addEventListener('pointermove', this.handlePointerMove)
    window.addEventListener('pointerup', this.handlePointerUp)
    window.addEventListener('pointercancel', this.handlePointerUp)

    this.drawSquares()
    this.drawCoordinates()
    this.drawHighlights()
  }

  setOnSquareClick(handler: (sq: Square) => void): void {
    this.onSquareClick = handler
  }

  setOnDragStart(handler: (from: Square) => boolean): void {
    this.onDragStart = handler
  }

  setOnDragEnd(handler: (from: Square, to: Square | null) => boolean): void {
    this.onDragEnd = handler
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
    this.app.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.app.canvas.removeEventListener('pointerleave', this.handleCanvasLeave)
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('pointerup', this.handlePointerUp)
    window.removeEventListener('pointercancel', this.handlePointerUp)
    this.app.destroy(true, { children: true })
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    if (this.session) return
    const square = this.squareFromClient(event.clientX, event.clientY)
    this.session = {
      pointerId: event.pointerId,
      startSquare: square,
      startClientX: event.clientX,
      startClientY: event.clientY,
      drag: null,
    }
    event.preventDefault()
  }

  private onPointerMove(event: PointerEvent): void {
    this.updateHover(event.clientX, event.clientY)
    if (!this.session || event.pointerId !== this.session.pointerId) return
    if (!this.session.drag) {
      const dx = event.clientX - this.session.startClientX
      const dy = event.clientY - this.session.startClientY
      if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return
      if (!this.session.startSquare) return
      const from = this.session.startSquare
      const sprite = this.sprites.get(from)
      if (!sprite) return
      if (!this.onDragStart?.(from)) return
      const { x, y } = squareToPixel(from)
      this.session.drag = {
        from,
        sprite,
        originX: x + SQUARE_SIZE / 2,
        originY: y + SQUARE_SIZE / 2,
      }
      this.pieceLayer.removeChild(sprite)
      this.pieceLayer.addChild(sprite)
      sprite.scale.set(1.08)
      sprite.alpha = 0.95
    }
    const local = this.clientToBoardLocal(event.clientX, event.clientY)
    this.session.drag.sprite.x = local.x
    this.session.drag.sprite.y = local.y
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.session || event.pointerId !== this.session.pointerId) return
    const session = this.session
    this.session = null

    if (session.drag) {
      const drop = this.squareFromClient(event.clientX, event.clientY)
      const accepted = this.onDragEnd?.(session.drag.from, drop) ?? false
      const sprite = session.drag.sprite
      sprite.scale.set(1)
      sprite.alpha = 1
      if (!accepted) {
        gsap.to(sprite, {
          x: session.drag.originX,
          y: session.drag.originY,
          duration: 0.18,
          ease: 'power2.out',
        })
      }
      return
    }

    if (session.startSquare) {
      const releaseSquare = this.squareFromClient(event.clientX, event.clientY)
      if (releaseSquare === session.startSquare) {
        this.onSquareClick?.(session.startSquare)
      }
    }
  }

  private updateHover(clientX: number, clientY: number): void {
    const sq = this.squareFromClient(clientX, clientY)
    if (sq === this.hoverSquare) return
    this.hoverSquare = sq
    if (this.highlights.selected) this.drawHighlights()
  }

  private clearHover(): void {
    if (this.hoverSquare === null) return
    this.hoverSquare = null
    if (this.highlights.selected) this.drawHighlights()
  }

  private squareFromClient(clientX: number, clientY: number): Square | null {
    const local = this.clientToBoardLocal(clientX, clientY)
    const f = Math.floor(local.x / SQUARE_SIZE)
    const r = Math.floor(local.y / SQUARE_SIZE)
    if (f < 0 || f > 7 || r < 0 || r > 7) return null
    const file = FILES[f]
    const rank = RANKS[7 - r]
    if (!file || !rank) return null
    return `${file}${rank}` as Square
  }

  private clientToBoardLocal(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect()
    const scaleX = rect.width === 0 ? 1 : CANVAS_PX / rect.width
    const scaleY = rect.height === 0 ? 1 : CANVAS_PX / rect.height
    const x = (clientX - rect.left) * scaleX - MARGIN
    const y = (clientY - rect.top) * scaleY - MARGIN
    return { x, y }
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

    if (selected && this.hoverSquare && this.hoverSquare !== selected) {
      const { x, y } = squareToPixel(this.hoverSquare)
      const isLegal = legal.includes(this.hoverSquare)
      const color = isLegal ? COLOR_HOVER_LEGAL : COLOR_HOVER
      const g = new Graphics().rect(0, 0, SQUARE_SIZE, SQUARE_SIZE).stroke({ color, width: 3, alignment: 1 })
      g.x = x
      g.y = y
      this.highlightLayer.addChild(g)
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
