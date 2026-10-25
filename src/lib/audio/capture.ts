import type { AudioSample, CaptureError, CaptureErrorCode, CaptureStatus } from '../types'

/** How often the engine hands a sample to the UI (≈30 Hz). */
const SAMPLE_INTERVAL_MS = 33
/** The analyser buffer is processed at most this often, even if rAF fires faster. */
const POLL_INTERVAL_MS = 10

export interface AudioInput {
  deviceId: string
  label: string
  isDefault: boolean
}

export interface CaptureStartOptions {
  /** A concrete deviceId, or 'default' to follow the system default input. */
  deviceId?: string
}

export function mapCaptureError(error: unknown): CaptureError {
  const name = error instanceof DOMException ? error.name : ''
  const fallback = error instanceof Error ? error.message : String(error)

  const code: CaptureErrorCode = (() => {
    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
      case 'SecurityError':
        return 'denied'
      case 'NotFoundError':
      case 'OverconstrainedError':
      case 'DevicesNotFoundError':
        return 'no-device'
      case 'NotReadableError':
      case 'TrackStartError':
        return 'busy'
      case 'TypeError':
        return 'not-supported'
      default:
        return 'unknown'
    }
  })()

  return { code, message: fallback || name || 'unknown error' }
}

/**
 * Thin wrapper around the Web Audio capture chain.
 *
 * Mirrors the proven approach of the reference noise monitor:
 *  - microphone constraints with echo cancellation / noise suppression / AGC disabled
 *  - AnalyserNode with getFloatTimeDomainData, byte fallback for older engines
 *  - rAF loop plus a timer fallback so a hidden or throttled window keeps sampling
 *  - a zero gain sink so the graph reaches the destination on stubborn engines
 *  - every node and track released on stop, so the Windows mic indicator goes dark
 */
export class AudioEngine {
  private context: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private sink: GainNode | null = null
  private floatBuffer: Float32Array<ArrayBuffer> | null = null
  private byteBuffer: Uint8Array<ArrayBuffer> | null = null
  private rafId = 0
  private timerId = 0
  private lastSampleAt = 0
  private lastPollAt = 0
  private running = false
  private listenersAttached = false
  /** Guards against a stop() landing while start() is still awaiting the mic. */
  private generation = 0

  /** True when the strict constraints were refused and `{audio:true}` was used instead. */
  constraintFallback = false
  /** True when getFloatTimeDomainData was unavailable and the byte path is in use. */
  bytePath = false

  constructor(
    private readonly onSample: (sample: AudioSample) => void,
    private readonly onStatus: (status: CaptureStatus, error?: CaptureError) => void,
  ) {}

  get isRunning(): boolean {
    return this.running
  }

  get mediaStream(): MediaStream | null {
    return this.stream
  }

  get audioContext(): AudioContext | null {
    return this.context
  }

  get contextState(): AudioContextState | 'none' {
    return this.context?.state ?? 'none'
  }

  get trackLabel(): string {
    return this.stream?.getAudioTracks()[0]?.label ?? ''
  }

  async start(options: CaptureStartOptions = {}): Promise<void> {
    if (this.running) return
    const generation = ++this.generation
    this.onStatus('starting')

    if (!window.isSecureContext) {
      this.onStatus('error', {
        code: 'not-supported',
        message: '麦克风需要安全上下文（https 或 localhost）',
      })
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.onStatus('error', {
        code: 'not-supported',
        message: '当前环境不提供麦克风接口',
      })
      return
    }

    try {
      const context = new AudioContext()
      this.context = context
      await context.resume().catch(() => undefined)
      if (generation !== this.generation) {
        void context.close().catch(() => undefined)
        return
      }

      const stream = await this.requestStream(options.deviceId)
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop())
        void context.close().catch(() => undefined)
        return
      }
      this.stream = stream

      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.2

      const source = context.createMediaStreamSource(stream)
      const sink = context.createGain()
      sink.gain.value = 0

      source.connect(analyser)
      analyser.connect(sink)
      sink.connect(context.destination)

      this.source = source
      this.analyser = analyser
      this.sink = sink
      this.running = true

      this.attachContextListeners()
      this.startLoops()

      if (context.state !== 'running') {
        // Chromium may keep the context suspended until a user gesture.
        this.onStatus('suspended')
      } else {
        this.onStatus('running')
      }
    } catch (error) {
      this.teardown()
      this.onStatus('error', mapCaptureError(error))
    }
  }

  /** Resume a suspended context (used after the first user gesture). */
  async resume(): Promise<void> {
    if (!this.context) return
    await this.context.resume().catch(() => undefined)
    if (this.context.state === 'running' && this.running) {
      this.onStatus('running')
    }
  }

  stop(): void {
    this.teardown()
    this.onStatus('idle')
  }

  async switchDevice(deviceId: string): Promise<void> {
    if (!this.running) {
      await this.start({ deviceId })
      return
    }
    this.teardown()
    await this.start({ deviceId })
  }

  private async requestStream(deviceId?: string): Promise<MediaStream> {
    const strict: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }
    if (deviceId && deviceId !== 'default') {
      strict.deviceId = { exact: deviceId }
    }

    try {
      return await navigator.mediaDevices.getUserMedia({ audio: strict, video: false })
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      const constraintIssue =
        name === 'OverconstrainedError' || name === 'NotFoundError' || name === 'TypeError'
      if (!constraintIssue) throw error

      // Some drivers refuse the processing flags or the concrete device; fall back.
      this.constraintFallback = true
      if (deviceId && deviceId !== 'default') {
        try {
          return await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: deviceId } },
            video: false,
          })
        } catch {
          // fall through to the default device
        }
      }
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    }
  }

  private startLoops(): void {
    this.stopLoops()
    this.rafId = requestAnimationFrame(this.loop)
    // rAF freezes when the window is hidden or minimised; keep a timer as a safety net.
    this.timerId = window.setInterval(() => this.poll(), 100)
  }

  private stopLoops(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
    if (this.timerId) {
      window.clearInterval(this.timerId)
      this.timerId = 0
    }
  }

  private loop = (): void => {
    this.poll()
    this.rafId = requestAnimationFrame(this.loop)
  }

  private poll(): void {
    const analyser = this.analyser
    if (!analyser) return

    const now = performance.now()
    if (now - this.lastPollAt < POLL_INTERVAL_MS) return
    this.lastPollAt = now

    if (this.context && this.context.state === 'suspended') {
      void this.context.resume().catch(() => undefined)
    }

    const rms = this.readRms(analyser)
    if (rms === null) return
    if (now - this.lastSampleAt < SAMPLE_INTERVAL_MS) return
    this.lastSampleAt = now

    this.onSample({ rms, t: now })
  }

  private readRms(analyser: AnalyserNode): number | null {
    const size = analyser.fftSize

    try {
      if (typeof analyser.getFloatTimeDomainData === 'function') {
        if (!this.floatBuffer || this.floatBuffer.length !== size) {
          this.floatBuffer = new Float32Array(size)
        }
        analyser.getFloatTimeDomainData(this.floatBuffer)
        let sum = 0
        for (let i = 0; i < this.floatBuffer.length; i += 1) {
          const value = this.floatBuffer[i]
          sum += value * value
        }
        this.bytePath = false
        return Math.sqrt(sum / this.floatBuffer.length)
      }
      throw new Error('float path unavailable')
    } catch {
      // Older engines: 8-bit time domain is the reliable path.
      if (!this.byteBuffer || this.byteBuffer.length !== size) {
        this.byteBuffer = new Uint8Array(size)
      }
      analyser.getByteTimeDomainData(this.byteBuffer)
      let sum = 0
      for (let i = 0; i < this.byteBuffer.length; i += 1) {
        const value = (this.byteBuffer[i] - 128) / 128
        sum += value * value
      }
      this.bytePath = true
      return Math.sqrt(sum / this.byteBuffer.length)
    }
  }

  private attachContextListeners(): void {
    if (this.listenersAttached) return
    this.listenersAttached = true
    document.addEventListener('visibilitychange', this.handleVisibility)
  }

  private handleVisibility = (): void => {
    if (!this.context) return
    if (document.visibilityState === 'visible' && this.context.state === 'suspended' && this.running) {
      void this.context.resume().catch(() => undefined)
    }
  }

  private teardown(): void {
    this.generation += 1
    this.running = false
    this.stopLoops()

    if (this.listenersAttached) {
      document.removeEventListener('visibilitychange', this.handleVisibility)
      this.listenersAttached = false
    }

    try {
      this.source?.disconnect()
      this.analyser?.disconnect()
      this.sink?.disconnect()
    } catch {
      // ignore – nodes may already be detached
    }

    this.stream?.getTracks().forEach((track) => track.stop())

    if (this.context && this.context.state !== 'closed') {
      void this.context.close().catch(() => undefined)
    }

    this.source = null
    this.analyser = null
    this.sink = null
    this.stream = null
    this.context = null
    this.floatBuffer = null
    this.byteBuffer = null
    this.constraintFallback = false
  }
}

/** Enumerate microphone inputs. Labels are empty until permission has been granted once. */
export async function listAudioInputs(): Promise<AudioInput[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  const inputs = devices.filter((d) => d.kind === 'audioinput')
  return inputs.map((d, index) => ({
    deviceId: d.deviceId,
    label: d.label || (index === 0 ? '默认麦克风' : `麦克风 ${index + 1}`),
    isDefault: d.deviceId === 'default' || index === 0,
  }))
}

export function onDeviceChange(listener: () => void): () => void {
  if (!navigator.mediaDevices?.addEventListener) return () => undefined
  navigator.mediaDevices.addEventListener('devicechange', listener)
  return () => navigator.mediaDevices.removeEventListener('devicechange', listener)
}
