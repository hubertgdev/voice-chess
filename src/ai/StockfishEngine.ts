import type { Square } from '../types'

export interface AiMove {
  from: Square
  to: Square
  promotion?: 'q' | 'r' | 'b' | 'n'
}

export class StockfishEngine {
  private worker: Worker | null = null
  private ready = false
  private pendingHandshake: { command: string; expected: string; resolve: () => void } | null = null
  private pendingMove: ((move: AiMove | null) => void) | null = null
  private skill = 5

  async init(): Promise<void> {
    if (this.ready) return
    const baseUrl = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL
    const origin = window.location.origin
    const jsUrl = new URL(`${baseUrl}stockfish/stockfish-18-lite-single.js`, origin).href
    const wasmUrl = new URL(`${baseUrl}stockfish/stockfish-18-lite-single.wasm`, origin).href

    this.worker = new Worker(`${jsUrl}#${encodeURIComponent(wasmUrl)}`)
    this.worker.onmessage = (event) => this.handleMessage(String(event.data ?? ''))
    this.worker.onerror = (event) => {
      console.error('[stockfish] worker error', event)
    }

    await this.handshake('uci', 'uciok')
    await this.handshake('isready', 'readyok')
    this.send(`setoption name Skill Level value ${this.skill}`)
    this.ready = true
  }

  setSkill(level: number): void {
    const clamped = Math.max(0, Math.min(20, Math.round(level)))
    this.skill = clamped
    if (this.ready) this.send(`setoption name Skill Level value ${clamped}`)
  }

  newGame(): void {
    if (!this.ready) return
    this.send('ucinewgame')
    this.send('isready')
  }

  async bestMove(fen: string, movetimeMs: number): Promise<AiMove | null> {
    if (!this.ready || !this.worker) return null
    if (this.pendingMove) {
      this.send('stop')
      this.pendingMove(null)
      this.pendingMove = null
    }
    this.send(`position fen ${fen}`)
    return new Promise<AiMove | null>((resolve) => {
      this.pendingMove = resolve
      this.send(`go movetime ${movetimeMs}`)
    })
  }

  stop(): void {
    if (!this.ready || !this.worker) return
    this.send('stop')
  }

  destroy(): void {
    if (this.pendingMove) {
      this.pendingMove(null)
      this.pendingMove = null
    }
    if (this.worker) {
      try {
        this.worker.postMessage('quit')
      } catch (_err) {
        /* ignore */
      }
      this.worker.terminate()
      this.worker = null
    }
    this.ready = false
  }

  private send(command: string): void {
    this.worker?.postMessage(command)
  }

  private handshake(command: string, expected: string): Promise<void> {
    return new Promise((resolve) => {
      this.pendingHandshake = { command, expected, resolve }
      this.send(command)
    })
  }

  private handleMessage(line: string): void {
    if (this.pendingHandshake && line.includes(this.pendingHandshake.expected)) {
      const { resolve } = this.pendingHandshake
      this.pendingHandshake = null
      resolve()
      return
    }
    if (this.pendingMove && line.startsWith('bestmove')) {
      const move = parseBestMove(line)
      const cb = this.pendingMove
      this.pendingMove = null
      cb(move)
    }
  }
}

function parseBestMove(line: string): AiMove | null {
  const match = /^bestmove\s+(\S+)/.exec(line)
  if (!match) return null
  const raw = match[1]
  if (!raw || raw === '(none)' || raw === '0000') return null
  if (raw.length < 4) return null
  const from = raw.slice(0, 2) as Square
  const to = raw.slice(2, 4) as Square
  const promo = raw.length >= 5 ? (raw[4] as 'q' | 'r' | 'b' | 'n') : undefined
  return promo ? { from, to, promotion: promo } : { from, to }
}
