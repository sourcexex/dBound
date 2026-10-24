import type { Level, Mode } from './types'

/**
 * Default calibration offset.
 * `db = 20*log10(rms) + offset`, so a quiet room (rms ~0.0005, -66 dBFS) reads ~30 dB
 * and normal speech close to the mic (rms ~0.02, -34 dBFS) reads ~61 dB.
 * This is a *guess* for a typical laptop mic; the calibration flow refines it and the
 * UI must always keep the "≈" prefix so nobody mistakes it for a calibrated SPL meter.
 */
export const DEFAULT_OFFSET = 95

export const DB_MIN = 0
export const DB_MAX = 120

/** Time constants (ms) for the display weighting. */
export const TAU_FAST = 125
export const TAU_SLOW = 1000
export const TAU_READING = 3000

/** Frame-level EMA factor (0.28 of the new value), matching the reference monitor. */
export const FRAME_ALPHA = 0.28

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Linear RMS -> dBFS (-160..0). */
export function rmsToDbfs(rms: number): number {
  return 20 * Math.log10(Math.max(rms, 1e-8))
}

/** Linear RMS -> estimated dB using the calibration offset. */
export function rmsToDb(rms: number, offset: number): number {
  return clamp(rmsToDbfs(rms) + offset, DB_MIN, DB_MAX)
}

/** Frame-level exponential moving average (reference monitor uses 0.72/0.28). */
export function frameAverage(previous: number, next: number, alpha = FRAME_ALPHA): number {
  if (!Number.isFinite(previous)) return next
  return previous + (next - previous) * alpha
}

/** Display-level exponential weighting with a time constant in milliseconds. */
export function timeWeight(previous: number, next: number, dtMs: number, tauMs: number): number {
  if (!Number.isFinite(previous) || tauMs <= 0) return next
  const alpha = 1 - Math.exp(-Math.max(dtMs, 1) / tauMs)
  return previous + (next - previous) * alpha
}

/** Which level is currently the most severe match for a reading. */
export function pickActiveLevel(mode: Mode, levels: Level[], db: number): Level | null {
  let best: Level | null = null
  for (const level of levels) {
    if (!level.enabled) continue
    const matched = mode === 'forward' ? db >= level.threshold : db <= level.threshold
    if (!matched) continue
    if (mode === 'forward') {
      if (!best || level.threshold > best.threshold) best = level
    } else if (!best || level.threshold < best.threshold) {
      best = level
    }
  }
  return best
}

/** Levels ordered from least to most severe for the editor list. */
export function sortLevels(mode: Mode, levels: Level[]): Level[] {
  return [...levels].sort((a, b) =>
    mode === 'forward' ? a.threshold - b.threshold : b.threshold - a.threshold,
  )
}

/** Threshold ordering is valid when severity increases monotonically. */
export function validateLevels(mode: Mode, levels: Level[]): string | null {
  const enabled = levels.filter((l) => l.enabled)
  for (let i = 1; i < enabled.length; i += 1) {
    const previous = enabled[i - 1]
    const current = enabled[i]
    const ok =
      mode === 'forward' ? current.threshold > previous.threshold : current.threshold < previous.threshold
    if (!ok) {
      return mode === 'forward'
        ? `「${current.name}」的阈值应高于「${previous.name}」`
        : `「${current.name}」的阈值应低于「${previous.name}」`
    }
  }
  return null
}

/** Time constant for the current display mode. */
export function tauForMode(mode: Mode, readingSmooth: boolean): number {
  if (mode === 'reverse') return readingSmooth ? TAU_READING : TAU_SLOW
  return TAU_FAST
}
