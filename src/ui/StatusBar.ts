import type { Color, Language } from '../types'

export interface StatusBarHandlers {
  onReset: () => void
  onToggleVoice: () => void
  onLanguageChange: (lang: Language) => void
}

export class StatusBar {
  readonly root: HTMLElement
  private turnEl: HTMLElement
  private messageEl: HTMLElement
  private partialEl: HTMLElement
  private voiceBtn: HTMLButtonElement
  private langSelect: HTMLSelectElement

  constructor(handlers: StatusBarHandlers) {
    this.root = el('div', 'status-bar')

    const turnLabel = el('span', 'status-bar__turn-label', 'Turn:')
    this.turnEl = el('strong', 'status-bar__turn', 'White')
    const turnRow = el('div', 'status-bar__row')
    turnRow.append(turnLabel, this.turnEl)

    this.messageEl = el('div', 'status-bar__message', '')

    this.partialEl = el('div', 'status-bar__partial', '')

    this.voiceBtn = el('button', 'btn btn--voice', 'Enable voice') as HTMLButtonElement
    this.voiceBtn.type = 'button'
    this.voiceBtn.addEventListener('click', () => handlers.onToggleVoice())

    this.langSelect = document.createElement('select')
    this.langSelect.className = 'select select--lang'
    for (const [value, label] of [
      ['en', 'English'],
      ['fr', 'Français'],
    ] as const) {
      const opt = document.createElement('option')
      opt.value = value
      opt.textContent = label
      this.langSelect.appendChild(opt)
    }
    this.langSelect.addEventListener('change', () => {
      handlers.onLanguageChange(this.langSelect.value as Language)
    })

    const resetBtn = el('button', 'btn btn--reset', 'Reset') as HTMLButtonElement
    resetBtn.type = 'button'
    resetBtn.addEventListener('click', () => handlers.onReset())

    const controls = el('div', 'status-bar__controls')
    controls.append(this.langSelect, this.voiceBtn, resetBtn)

    this.root.append(turnRow, this.messageEl, this.partialEl, controls)
  }

  setTurn(color: Color, inCheck: boolean): void {
    this.turnEl.textContent = `${color === 'w' ? 'White' : 'Black'}${inCheck ? ' (check!)' : ''}`
  }

  setMessage(text: string, tone: 'info' | 'error' | 'success' = 'info'): void {
    this.messageEl.textContent = text
    this.messageEl.dataset.tone = tone
  }

  setPartial(text: string): void {
    this.partialEl.textContent = text
  }

  setVoiceLabel(label: string, busy = false): void {
    this.voiceBtn.textContent = label
    this.voiceBtn.disabled = busy
  }

  setLanguage(lang: Language): void {
    this.langSelect.value = lang
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
