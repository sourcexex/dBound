/** WAV encoding + a RAM-only audio ring buffer (the "time machine"). */

const TARGET_SAMPLE_RATE = 16000
const PROCESSOR_BLOCK = 4096

export interface EvidenceCapture {
  wav: ArrayBuffer
  durationSeconds: number
}

function concatBlocks(blocks: Float32Array[]): Float32Array {
  const total = blocks.reduce((sum, block) => sum + block.length, 0)
  const merged = new Float32Array(total)
  let offset = 0
  for (const block of blocks) {
    merged.set(block, offset)
    offset += block.length
  }
  return merged
}

/** Keep only the trailing `frames` samples of a block list. */
function tailBlocks(blocks: Float32Array[], frames: number): Float32Array[] {
  const result: Float32Array[] = []
  let remaining = frames
  for (let index = blocks.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const block = blocks[index]
    if (block.length <= remaining) {
      result.unshift(block)
      remaining -= block.length
    } else {
      result.unshift(block.slice(block.length - remaining))
      remaining = 0
    }
  }
  return result
}

/** Linear resample to 16 kHz mono, then encode a 16-bit PCM WAV. */
export function encodeWav(samples: Float32Array, sourceRate: number): ArrayBuffer {
  const ratio = sourceRate / TARGET_SAMPLE_RATE
  const outLength = Math.max(1, Math.floor(samples.length / ratio))
  const pcm = new Int16Array(outLength)

  for (let index = 0; index < outLength; index += 1) {
    const position = index * ratio
    const left = Math.floor(position)
    const right = Math.min(left + 1, samples.length - 1)
    const mix = position - left
    const value = samples[left] * (1 - mix) + samples[right] * mix
    pcm[index] = Math.max(-1, Math.min(1, value)) * 0x7fff
  }

  const buffer = new ArrayBuffer(44 + pcm.length * 2)
  const view = new DataView(buffer)
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }

  writeText(0, 'RIFF')
  view.setUint32(4, 36 + pcm.length * 2, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, TARGET_SAMPLE_RATE, true)
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, pcm.length * 2, true)

  let offset = 44
  for (let index = 0; index < pcm.length; index += 1) {
    view.setInt16(offset, pcm[index], true)
    offset += 2
  }
  return buffer
}

/**
 * Continuously buffers the last N seconds of microphone audio in memory.
 * Nothing is written to disk until `capture()` is called (an alert fired).
 */
export class TimeMachine {
  private readonly context: AudioContext
  private readonly source: MediaStreamAudioSourceNode
  private readonly processor: ScriptProcessorNode
  private readonly sink: GainNode

  private blocks: Float32Array[] = []
  private frames = 0
  private prerollFrames: number
  private disposed = false

  private capture:
    | {
        preBlocks: Float32Array[]
        postBlocks: Float32Array[]
        postFrames: number
        postLimit: number
        resolve: (result: EvidenceCapture) => void
        reject: (error: Error) => void
      }
    | null = null

  constructor(context: AudioContext, stream: MediaStream, prerollSeconds = 5) {
    this.context = context
    this.source = context.createMediaStreamSource(stream)
    this.processor = context.createScriptProcessor(PROCESSOR_BLOCK, 1, 1)
    this.sink = context.createGain()
    this.sink.gain.value = 0

    this.prerollFrames = Math.max(1, Math.round(prerollSeconds * context.sampleRate))
    this.processor.onaudioprocess = (event) => this.push(event.inputBuffer.getChannelData(0))
    this.source.connect(this.processor)
    this.processor.connect(this.sink)
    this.sink.connect(context.destination)
  }

  get isCapturing(): boolean {
    return this.capture !== null
  }

  setPrerollSeconds(seconds: number): void {
    this.prerollFrames = Math.max(1, Math.round(seconds * this.context.sampleRate))
    this.trimRing()
  }

  /** Grab the last `preSeconds` and keep recording for `postSeconds`. */
  captureWindow(preSeconds: number, postSeconds: number): Promise<EvidenceCapture> {
    if (this.disposed) return Promise.reject(new Error('recorder disposed'))
    if (this.capture) return Promise.reject(new Error('already recording'))

    this.setPrerollSeconds(preSeconds)
    const rate = this.context.sampleRate
    const preBlocks = tailBlocks(this.blocks, Math.round(preSeconds * rate))

    return new Promise<EvidenceCapture>((resolve, reject) => {
      this.capture = {
        preBlocks,
        postBlocks: [],
        postFrames: 0,
        postLimit: Math.max(1, Math.round(postSeconds * rate)),
        resolve,
        reject,
      }
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.capture) {
      this.capture.reject(new Error('recorder stopped'))
      this.capture = null
    }
    try {
      this.processor.onaudioprocess = null
      this.source.disconnect()
      this.processor.disconnect()
      this.sink.disconnect()
    } catch {
      // nodes may already be detached
    }
    this.blocks = []
    this.frames = 0
  }

  private push(input: Float32Array): void {
    if (this.disposed) return
    const chunk = new Float32Array(input)
    this.blocks.push(chunk)
    this.frames += chunk.length
    this.trimRing()

    const capture = this.capture
    if (!capture) return
    capture.postBlocks.push(chunk)
    capture.postFrames += chunk.length
    if (capture.postFrames >= capture.postLimit) {
      this.finish(capture)
    }
  }

  private trimRing(): void {
    while (this.blocks.length > 1 && this.frames - this.blocks[0].length >= this.prerollFrames) {
      this.frames -= this.blocks[0].length
      this.blocks.shift()
    }
  }

  private finish(capture: NonNullable<TimeMachine['capture']>): void {
    this.capture = null
    const post = tailBlocks(capture.postBlocks, capture.postLimit)
    const all = [...capture.preBlocks, ...post]
    const samples = concatBlocks(all)
    const wav = encodeWav(samples, this.context.sampleRate)
    capture.resolve({
      wav,
      durationSeconds: samples.length / this.context.sampleRate,
    })
  }
}
