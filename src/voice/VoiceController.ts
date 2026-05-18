import type { Language } from '../types'

const MODEL_URLS: Record<Language, string> = {
  en: 'models/vosk-model-small-en-us-0.15.tar.gz',
  fr: 'models/vosk-model-small-fr-0.22.tar.gz',
}

export interface VoiceEvents {
  onPartial?: (text: string) => void
  onFinal?: (text: string) => void
  onError?: (error: string) => void
  onStateChange?: (state: VoiceState) => void
}

export type VoiceState = 'idle' | 'loading' | 'listening' | 'error'

export class VoiceController {
  private state: VoiceState = 'idle'
  private events: VoiceEvents
  private audioCtx: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private model: unknown = null
  private recognizer: unknown = null
  private language: Language

  constructor(language: Language, events: VoiceEvents = {}) {
    this.language = language
    this.events = events
  }

  getState(): VoiceState {
    return this.state
  }

  getLanguage(): Language {
    return this.language
  }

  async setLanguage(lang: Language): Promise<void> {
    if (this.language === lang) return
    const wasListening = this.state === 'listening'
    await this.stop()
    this.language = lang
    if (wasListening) await this.start()
  }

  async start(): Promise<void> {
    if (this.state === 'listening' || this.state === 'loading') return
    this.setState('loading')
    try {
      const { createModel } = await import('vosk-browser')
      const modelUrl = MODEL_URLS[this.language]
      const baseUrl = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL
      const resolved = new URL(modelUrl, window.location.origin + baseUrl).href

      this.model = await createModel(resolved)
      const sampleRate = 16000

      const KaldiRecognizer = (this.model as { KaldiRecognizer: new (sr: number) => unknown }).KaldiRecognizer
      this.recognizer = new KaldiRecognizer(sampleRate)

      const rec = this.recognizer as {
        on: (event: string, cb: (m: unknown) => void) => void
      }
      rec.on('result', (m) => {
        const msg = m as { result: { text: string } }
        if (msg.result.text) this.events.onFinal?.(msg.result.text)
      })
      rec.on('partialresult', (m) => {
        const msg = m as { result: { partial: string } }
        if (msg.result.partial) this.events.onPartial?.(msg.result.partial)
      })
      rec.on('error', (m) => {
        const msg = m as { error: string }
        this.events.onError?.(msg.error)
      })

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate, echoCancellation: true, noiseSuppression: true },
        video: false,
      })

      const Ctx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.audioCtx = new Ctx({ sampleRate })
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream)
      this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1)
      this.processor.onaudioprocess = (event) => {
        if (!this.recognizer) return
        ;(
          this.recognizer as {
            acceptWaveformFloat: (buf: Float32Array, sr: number) => void
          }
        ).acceptWaveformFloat(event.inputBuffer.getChannelData(0), sampleRate)
      }
      this.sourceNode.connect(this.processor)
      this.processor.connect(this.audioCtx.destination)

      this.setState('listening')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.events.onError?.(`Failed to start voice: ${msg}`)
      this.setState('error')
      await this.stop()
    }
  }

  async stop(): Promise<void> {
    if (this.processor) {
      this.processor.disconnect()
      this.processor.onaudioprocess = null
      this.processor = null
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }
    if (this.audioCtx) {
      await this.audioCtx.close().catch(() => undefined)
      this.audioCtx = null
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) track.stop()
      this.mediaStream = null
    }
    if (this.recognizer) {
      ;(this.recognizer as { remove: () => void }).remove?.()
      this.recognizer = null
    }
    if (this.model) {
      ;(this.model as { terminate: () => void }).terminate?.()
      this.model = null
    }
    if (this.state !== 'error') this.setState('idle')
  }

  private setState(s: VoiceState): void {
    this.state = s
    this.events.onStateChange?.(s)
  }
}
