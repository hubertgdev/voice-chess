import { StockfishEngine } from '../ai/StockfishEngine'
import { BoardView } from '../render/Board'
import type { Color, Language, Square } from '../types'
import { StatusBar } from '../ui/StatusBar'
import { parseUtterance } from '../voice/parser'
import type { VoiceState } from '../voice/VoiceController'
import { VoiceController } from '../voice/VoiceController'
import { ChessEngine } from './ChessEngine'

const AI_COLOR: Color = 'b'
const AI_MOVETIME_MS = 600

export class GameController {
  private engine = new ChessEngine()
  private board = new BoardView()
  private status: StatusBar
  private voice: VoiceController
  private ai = new StockfishEngine()
  private selected: Square | null = null
  private lastMove: { from: Square; to: Square } | null = null
  private language: Language = 'en'
  private isAnimating = false
  private aiEnabled = false
  private aiThinking = false
  private aiGeneration = 0
  private skill = 5

  constructor() {
    this.status = new StatusBar({
      onReset: () => this.reset(),
      onToggleVoice: () => this.toggleVoice(),
      onLanguageChange: (lang) => this.changeLanguage(lang),
      onToggleAi: (enabled) => this.toggleAi(enabled),
      onSkillChange: (skill) => this.changeSkill(skill),
    })
    this.voice = new VoiceController(this.language, {
      onFinal: (text) => this.handleVoiceFinal(text),
      onPartial: (text) => this.status.setPartial(text),
      onError: (err) => this.status.setMessage(err, 'error'),
      onStateChange: (s) => this.handleVoiceStateChange(s),
    })
  }

  async mount(root: HTMLElement): Promise<void> {
    root.appendChild(this.status.root)
    const boardContainer = document.createElement('div')
    boardContainer.className = 'board-container'
    root.appendChild(boardContainer)
    await this.board.init(boardContainer)
    this.board.setOnSquareClick((sq) => this.handleSquareClick(sq))
    this.board.setOnDragStart((from) => this.handleDragStart(from))
    this.board.setOnDragEnd((from, to) => this.handleDragEnd(from, to))
    this.status.setSkill(this.skill)
    this.status.setAi(false)
    this.syncBoard()
    this.refreshStatus()
  }

  private handleSquareClick(sq: Square): void {
    if (!this.canHumanInteract()) return
    const status = this.engine.status()
    const piece = this.engine.pieceAt(sq)

    if (this.selected) {
      if (this.selected === sq) {
        this.clearSelection()
        return
      }
      if (piece && piece.color === status.turn) {
        this.selectSquare(sq)
        return
      }
      void this.attemptMove(this.selected, sq)
      return
    }

    if (piece && piece.color === status.turn) {
      this.selectSquare(sq)
    }
  }

  private handleDragStart(from: Square): boolean {
    if (!this.canHumanInteract()) return false
    const piece = this.engine.pieceAt(from)
    const status = this.engine.status()
    if (!piece || piece.color !== status.turn) return false
    this.selected = from
    this.board.setHighlights({
      selected: from,
      legal: this.engine.legalDestinations(from),
    })
    return true
  }

  private handleDragEnd(from: Square, to: Square | null): boolean {
    if (!to || to === from) {
      this.clearSelection()
      return false
    }
    if (!this.engine.legalDestinations(from).includes(to)) {
      this.clearSelection()
      return false
    }
    const result = this.engine.move(from, to)
    if (!result.ok) {
      this.clearSelection()
      return false
    }
    this.lastMove = { from, to }
    this.selected = null
    this.board.setPieces(this.engine.pieces())
    this.refreshStatus(result.san)
    this.refreshHighlights()
    void this.maybeTriggerAi()
    return true
  }

  private canHumanInteract(): boolean {
    if (this.isAnimating || this.aiThinking) return false
    const status = this.engine.status()
    if (status.gameOver) return false
    if (this.aiEnabled && status.turn === AI_COLOR) return false
    return true
  }

  private selectSquare(sq: Square): void {
    this.selected = sq
    this.board.setHighlights({
      selected: sq,
      legal: this.engine.legalDestinations(sq),
    })
  }

  private clearSelection(): void {
    this.selected = null
    this.board.setHighlights({ selected: null, legal: [] })
  }

  private async attemptMove(from: Square, to: Square): Promise<void> {
    const result = this.engine.move(from, to)
    if (!result.ok) {
      this.status.setMessage(`Illegal move: ${from} → ${to}`, 'error')
      this.clearSelection()
      return
    }
    this.lastMove = { from, to }
    this.selected = null
    this.isAnimating = true
    this.board.setHighlights({ selected: null, legal: [] })
    await this.board.animateMove(from, to, this.engine.pieces())
    this.isAnimating = false
    this.refreshStatus(result.san)
    this.refreshHighlights()
    void this.maybeTriggerAi()
  }

  private async maybeTriggerAi(): Promise<void> {
    if (!this.aiEnabled) return
    const status = this.engine.status()
    if (status.gameOver) return
    if (status.turn !== AI_COLOR) return
    await this.runAiMove()
  }

  private async runAiMove(): Promise<void> {
    this.aiThinking = true
    const myGen = ++this.aiGeneration
    this.status.setMessage('AI is thinking…', 'info')
    try {
      const move = await this.ai.bestMove(this.engine.fen(), AI_MOVETIME_MS)
      if (myGen !== this.aiGeneration) return
      this.aiThinking = false
      if (!move) {
        this.status.setMessage('AI returned no move', 'error')
        return
      }
      const result = this.engine.move(move.from, move.to)
      if (!result.ok) {
        this.status.setMessage(`AI illegal move: ${move.from}${move.to}`, 'error')
        return
      }
      this.lastMove = { from: move.from, to: move.to }
      this.isAnimating = true
      await this.board.animateMove(move.from, move.to, this.engine.pieces())
      this.isAnimating = false
      this.refreshStatus(result.san)
      this.refreshHighlights()
    } catch (err) {
      if (myGen !== this.aiGeneration) return
      this.aiThinking = false
      const msg = err instanceof Error ? err.message : String(err)
      this.status.setMessage(`AI error: ${msg}`, 'error')
    }
  }

  private async toggleAi(enabled: boolean): Promise<void> {
    if (enabled === this.aiEnabled) return
    if (enabled) {
      this.status.setAi(true, true)
      this.status.setMessage('Loading AI…', 'info')
      try {
        await this.ai.init()
        this.ai.setSkill(this.skill)
        this.ai.newGame()
        this.aiEnabled = true
        this.status.setAi(true, false)
        this.status.setMessage('AI ready', 'success')
        void this.maybeTriggerAi()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.status.setMessage(`Failed to load AI: ${msg}`, 'error')
        this.status.setAi(false, false)
        this.aiEnabled = false
      }
    } else {
      this.ai.stop()
      this.aiEnabled = false
      this.status.setAi(false, false)
      this.status.setMessage('AI disabled', 'info')
    }
  }

  private changeSkill(level: number): void {
    this.skill = level
    this.ai.setSkill(level)
  }

  private handleVoiceFinal(text: string): void {
    if (!text) return
    this.status.setPartial('')
    const outcome = parseUtterance(text, this.language)
    if (outcome.kind === 'reset') {
      this.reset()
      this.status.setMessage('Game reset', 'success')
      return
    }
    if (outcome.kind === 'move') {
      if (this.aiEnabled && this.engine.status().turn === AI_COLOR) {
        this.status.setMessage('Wait for the AI to move', 'error')
        return
      }
      const { from, to } = outcome.move
      this.status.setMessage(`Heard: ${from} → ${to}`, 'info')
      void this.attemptMove(from, to)
      return
    }
    if (outcome.kind === 'square') {
      this.handleVoiceSquare(outcome.square)
      return
    }
    if (outcome.kind === 'incomplete') {
      this.status.setMessage(`Heard partial: ${outcome.partial.join('')}`, 'error')
      return
    }
    this.status.setMessage(`Did not understand: "${text}"`, 'error')
  }

  private handleVoiceSquare(sq: Square): void {
    if (!this.canHumanInteract()) return
    const status = this.engine.status()
    const piece = this.engine.pieceAt(sq)

    if (this.selected) {
      if (this.selected === sq) {
        this.status.setMessage(`${sq} already selected`, 'info')
        return
      }
      if (piece && piece.color === status.turn) {
        this.selectSquare(sq)
        this.status.setMessage(`Selected ${sq}`, 'info')
        return
      }
      if (this.engine.legalDestinations(this.selected).includes(sq)) {
        this.status.setMessage(`Heard: ${this.selected} → ${sq}`, 'info')
        void this.attemptMove(this.selected, sq)
        return
      }
      this.status.setMessage(`${sq} is not a legal move`, 'info')
      return
    }

    if (piece && piece.color === status.turn) {
      this.selectSquare(sq)
      this.status.setMessage(`Selected ${sq}`, 'info')
      return
    }
    this.status.setMessage(`No piece to select on ${sq}`, 'info')
  }

  private handleVoiceStateChange(s: VoiceState): void {
    switch (s) {
      case 'idle':
        this.status.setVoiceLabel('Enable voice')
        break
      case 'loading':
        this.status.setVoiceLabel('Loading…', true)
        break
      case 'listening':
        this.status.setVoiceLabel('Stop voice')
        this.status.setMessage('Listening — speak a move like "e2 e4"', 'success')
        break
      case 'error':
        this.status.setVoiceLabel('Enable voice')
        break
    }
  }

  private async toggleVoice(): Promise<void> {
    if (this.voice.getState() === 'listening' || this.voice.getState() === 'loading') {
      await this.voice.stop()
      return
    }
    await this.voice.start()
  }

  private async changeLanguage(lang: Language): Promise<void> {
    this.language = lang
    await this.voice.setLanguage(lang)
    this.status.setLanguage(lang)
  }

  private reset(): void {
    this.aiGeneration++
    if (this.aiThinking) {
      this.ai.stop()
      this.aiThinking = false
    }
    this.engine.reset()
    this.selected = null
    this.lastMove = null
    this.syncBoard()
    this.refreshStatus()
    this.refreshHighlights()
    if (this.aiEnabled) this.ai.newGame()
    this.status.setMessage('New game', 'success')
    void this.maybeTriggerAi()
  }

  private syncBoard(): void {
    this.board.setPieces(this.engine.pieces())
  }

  private refreshStatus(san?: string): void {
    const s = this.engine.status()
    this.status.setTurn(s.turn, s.inCheck)
    if (s.checkmate) {
      this.status.setMessage(`Checkmate. ${winnerLabel(s.winner)} wins${san ? ` (${san})` : ''}`, 'success')
      return
    }
    if (s.stalemate) {
      this.status.setMessage('Stalemate — draw', 'info')
      return
    }
    if (s.draw) {
      this.status.setMessage('Draw', 'info')
      return
    }
    if (san) this.status.setMessage(`Move: ${san}`, 'info')
  }

  private refreshHighlights(): void {
    const s = this.engine.status()
    let checkSquare: Square | null = null
    if (s.inCheck) {
      for (const p of this.engine.pieces()) {
        if (p.type === 'k' && p.color === s.turn) {
          checkSquare = p.square
          break
        }
      }
    }
    this.board.setHighlights({
      selected: null,
      legal: [],
      lastMove: this.lastMove,
      check: checkSquare,
    })
  }
}

function winnerLabel(color: Color | null): string {
  if (!color) return ''
  return color === 'w' ? 'White' : 'Black'
}
