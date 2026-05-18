import type { Color, Language } from '../types'

export interface StatusBarHandlers {
  onReset: () => void
  onToggleVoice: () => void
  onLanguageChange: (lang: Language) => void
  onToggleAi: (enabled: boolean) => void
  onSkillChange: (skill: number) => void
}

export class StatusBar {
  readonly root: HTMLElement
  private turnEl: HTMLElement
  private messageEl: HTMLElement
  private partialEl: HTMLElement
  private voiceBtn: HTMLButtonElement
  private langSelect: HTMLSelectElement
  private aiCheckbox: HTMLInputElement
  private skillSlider: HTMLInputElement
  private skillValue: HTMLElement

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

    const aiRow = el('div', 'status-bar__ai')
    const aiLabel = document.createElement('label')
    aiLabel.className = 'status-bar__ai-toggle'
    this.aiCheckbox = document.createElement('input')
    this.aiCheckbox.type = 'checkbox'
    this.aiCheckbox.addEventListener('change', () => handlers.onToggleAi(this.aiCheckbox.checked))
    aiLabel.append(this.aiCheckbox, document.createTextNode(' Play vs AI'))

    const skillLabel = document.createElement('label')
    skillLabel.className = 'status-bar__skill'
    this.skillSlider = document.createElement('input')
    this.skillSlider.type = 'range'
    this.skillSlider.min = '0'
    this.skillSlider.max = '20'
    this.skillSlider.step = '1'
    this.skillSlider.value = '5'
    this.skillValue = el('span', 'status-bar__skill-value', '5')
    this.skillSlider.addEventListener('input', () => {
      const v = Number(this.skillSlider.value)
      this.skillValue.textContent = String(v)
      handlers.onSkillChange(v)
    })
    skillLabel.append(document.createTextNode('Skill '), this.skillSlider, this.skillValue)

    aiRow.append(aiLabel, skillLabel)

    this.root.append(turnRow, this.messageEl, this.partialEl, controls, aiRow)
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

  setAi(enabled: boolean, busy = false): void {
    this.aiCheckbox.checked = enabled
    this.aiCheckbox.disabled = busy
    this.skillSlider.disabled = !enabled || busy
  }

  setSkill(level: number): void {
    this.skillSlider.value = String(level)
    this.skillValue.textContent = String(level)
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
