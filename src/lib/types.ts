/** Shared domain types for dBound. */

export type Mode = 'forward' | 'reverse'

export interface Level {
  id: string
  /** Threshold in estimated dB. */
  threshold: number
  /** Short name shown next to the readout, e.g. 警告. */
  name: string
  /** Sentence shown when this level is active. */
  note: string
  /** Hex colour used for the readout / chip / capsule. */
  color: string
  enabled: boolean
}

export type CaptureStatus = 'idle' | 'starting' | 'running' | 'suspended' | 'error'

export type CaptureErrorCode =
  | 'not-supported'
  | 'denied'
  | 'no-device'
  | 'busy'
  | 'unknown'

export interface CaptureError {
  code: CaptureErrorCode
  message: string
}

export interface AudioSample {
  /** Linear RMS in the 0..1 range. */
  rms: number
  /** performance.now() timestamp. */
  t: number
}

export interface LevelReading {
  /** Smoothed estimated dB, 0..120. */
  db: number
  /** Peak estimate over the last few seconds. */
  peak: number
  /** Raw un-smoothed dB (for debugging / logs). */
  rawDb: number
}
