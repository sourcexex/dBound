import { DEFAULT_OFFSET } from './dsp'
import { LEVEL_PALETTE, defaultLevels } from './presets'
import type { Level, Mode } from './types'

export const SETTINGS_VERSION = 2
export const MAX_LEVELS = 8
export const MODE_LABEL_MAX = 8

export const DEFAULT_MODE_LABELS: Record<Mode, string> = {
  forward: '正向',
  reverse: '反向',
}

export interface PersistedSettings {
  mode: Mode
  /** User-facing name for each mode, e.g. 自习课模式 / 早读模式. */
  modeLabels: Record<Mode, string>
  offset: number
  readingSmooth: boolean
  showPeak: boolean
  deviceId: string
  levels: Record<Mode, Level[]>
}

export function defaultSettings(): PersistedSettings {
  return {
    mode: 'forward',
    modeLabels: { ...DEFAULT_MODE_LABELS },
    offset: DEFAULT_OFFSET,
    readingSmooth: true,
    showPeak: true,
    deviceId: 'default',
    levels: {
      forward: defaultLevels('forward'),
      reverse: defaultLevels('reverse'),
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function sanitizeLevel(value: unknown, index: number): Level | null {
  if (!isRecord(value)) return null

  const threshold = Number(value.threshold)
  if (!Number.isFinite(threshold)) return null

  const color = typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color)
    ? value.color
    : LEVEL_PALETTE[index % LEVEL_PALETTE.length]

  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : `level-${index}`,
    threshold: Math.min(120, Math.max(0, Math.round(threshold * 2) / 2)),
    name: typeof value.name === 'string' ? value.name.slice(0, 8) : `级别 ${index + 1}`,
    note: typeof value.note === 'string' ? value.note.slice(0, 30) : '',
    color,
    enabled: value.enabled !== false,
  }
}

function sanitizeLevels(value: unknown, mode: Mode): Level[] {
  if (!Array.isArray(value)) return defaultLevels(mode)

  const levels = value
    .slice(0, MAX_LEVELS)
    .map((entry, index) => sanitizeLevel(entry, index))
    .filter((entry): entry is Level => entry !== null)

  return levels.length > 0 ? levels : defaultLevels(mode)
}

function sanitizeModeLabels(value: unknown): Record<Mode, string> {
  const raw = isRecord(value) ? value : {}
  const pick = (candidate: unknown, fallback: string): string => {
    if (typeof candidate !== 'string') return fallback
    const trimmed = candidate.trim().slice(0, MODE_LABEL_MAX)
    return trimmed.length > 0 ? trimmed : fallback
  }
  return {
    forward: pick(raw.forward, DEFAULT_MODE_LABELS.forward),
    reverse: pick(raw.reverse, DEFAULT_MODE_LABELS.reverse),
  }
}

/** Keep only well-formed settings; fall back to defaults for anything broken. */
export function sanitizeSettings(value: unknown): PersistedSettings {
  const fallback = defaultSettings()
  if (!isRecord(value)) return fallback
  // `modeLabels` exists in every dBound payload. Its absence means the data comes
  // from a foreign/older layout (e.g. a previous prototype), so start clean.
  if (!isRecord(value.modeLabels)) return fallback

  const mode: Mode = value.mode === 'reverse' ? 'reverse' : 'forward'
  const offset = Number(value.offset)
  const deviceId = typeof value.deviceId === 'string' && value.deviceId.length > 0
    ? value.deviceId
    : 'default'
  const rawLevels = isRecord(value.levels) ? value.levels : {}

  return {
    mode,
    modeLabels: sanitizeModeLabels(value.modeLabels),
    offset: Number.isFinite(offset) ? Math.min(125, Math.max(65, Math.round(offset * 2) / 2)) : DEFAULT_OFFSET,
    readingSmooth: value.readingSmooth !== false,
    showPeak: value.showPeak !== false,
    deviceId,
    levels: {
      forward: sanitizeLevels(rawLevels.forward, 'forward'),
      reverse: sanitizeLevels(rawLevels.reverse, 'reverse'),
    },
  }
}

/**
 * Persisted state from an unknown or older layout is discarded rather than trusted.
 * Version 2 is the first dBound layout with `levels` keyed by mode.
 */
export function migrateSettings(persisted: unknown, version: number): PersistedSettings {
  if (version < SETTINGS_VERSION) return defaultSettings()
  return sanitizeSettings(persisted)
}
