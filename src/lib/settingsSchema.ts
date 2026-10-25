import { DEFAULT_OFFSET } from './dsp'
import { LEVEL_PALETTE, defaultLevels } from './presets'
import { DEFAULT_DARK_MODE, DEFAULT_THEME, isThemeId, type ThemeId } from './theme'
import {
  DEFAULT_SUBTITLE_COLOR,
  DEFAULT_SUBTITLE_SIZE,
  DEFAULT_TITLE_COLOR,
  DEFAULT_TITLE_FONT,
  DEFAULT_TITLE_SIZE,
  SUBTITLE_SIZE_MAX,
  SUBTITLE_SIZE_MIN,
  TITLE_SIZE_MAX,
  TITLE_SIZE_MIN,
  isKnownTitleFont,
} from './titleFonts'
import type { Level, Mode } from './types'

export const SETTINGS_VERSION = 2
export const MAX_LEVELS = 8
export const MODE_LABEL_MAX = 8
export const FULLSCREEN_TITLE_MAX = 20
export const FULLSCREEN_SUBTITLE_MAX = 36

export const DEFAULT_MODE_LABELS: Record<Mode, string> = {
  forward: '正向',
  reverse: '反向',
}

/** Copy shown when no level is hit. */
export const IDLE_TEXT_MAX = 12
export const DEFAULT_IDLE_TEXT: Record<Mode, string> = {
  forward: '安静',
  reverse: '音量正常',
}

export const DEFAULT_FULLSCREEN_TITLE = 'dBound'
export const DEFAULT_FULLSCREEN_SUBTITLE = '实时响度估测'

/** Readout animation: how often the digits refresh and how long they roll. */
export const DEFAULT_READOUT_ANIMATION = true
export const DEFAULT_ROLLING_MS = 600
export const ROLLING_MS_MIN = 200
export const ROLLING_MS_MAX = 900
export const DEFAULT_READOUT_INTERVAL_MS = 1000
export const READOUT_INTERVAL_MIN = 200
export const READOUT_INTERVAL_MAX = 1200

/** Emoji reward shown in fullscreen when the room meets the mode's goal. */
export interface EmojiRule {
  enabled: boolean
  /** dB threshold: reverse mode rewards "loud enough", forward rewards "quiet enough". */
  threshold: number
  /** How long the condition must hold before one emoji pops in. */
  holdSeconds: number
  /** How many emoji are already on screen when fullscreen opens. */
  initial: number
}

export interface EmojiSettings {
  forward: EmojiRule
  reverse: EmojiRule
}

export const EMOJI_MAX = 80
export const EMOJI_THRESHOLD_MIN = 0
export const EMOJI_THRESHOLD_MAX = 120
export const EMOJI_HOLD_MIN = 1
export const EMOJI_HOLD_MAX = 30
export const EMOJI_INITIAL_MIN = 0
export const EMOJI_INITIAL_MAX = 40

export const DEFAULT_EMOJI_SETTINGS: EmojiSettings = {
  forward: { enabled: true, threshold: 45, holdSeconds: 5, initial: 3 },
  reverse: { enabled: true, threshold: 70, holdSeconds: 5, initial: 3 },
}

/** Camera snapshot taken at the trigger moment. */
export const DEFAULT_SNAPSHOT_ENABLED = false
export const DEFAULT_CAMERA_ID = 'default'
export const SNAPSHOT_SIZES = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
} as const
export type SnapshotSize = keyof typeof SNAPSHOT_SIZES
export const DEFAULT_SNAPSHOT_SIZE: SnapshotSize = '1080p'

/** Evidence recording (time machine). */
export const DEFAULT_RECORDING_ENABLED = true
export const DEFAULT_PREROLL_SECONDS = 5
export const DEFAULT_POSTROLL_SECONDS = 10
export const PREROLL_MIN = 1
export const PREROLL_MAX = 10
export const POSTROLL_MIN = 5
export const POSTROLL_MAX = 30

/** Fullscreen status line ("音量正常" / level name) typography. */
export const DEFAULT_STATUS_FONT = 'system'
export const STATUS_SIZE_MIN = 10
export const STATUS_SIZE_MAX = 32
export const DEFAULT_STATUS_SIZE = 15

export interface PersistedSettings {
  mode: Mode
  /** Colour theme and light/dark appearance. */
  theme: ThemeId
  darkMode: boolean
  /** User-facing name for each mode, e.g. 自习课模式 / 早读模式. */
  modeLabels: Record<Mode, string>
  /** Colour of the big number when no level is active; '' means automatic. */
  idleNumberColor: string
  /** Typography/copy of the status line (main window chip + fullscreen). */
  statusColor: string
  idleText: Record<Mode, string>
  /** Title / subtitle shown in the top-left corner of fullscreen mode. */
  fullscreenTitle: string
  fullscreenSubtitle: string
  fullscreenTitleFont: string
  fullscreenTitleSize: number
  fullscreenTitleColor: string
  fullscreenSubtitleSize: number
  fullscreenSubtitleColor: string
  statusFont: string
  statusSize: number
  /** Evidence recording: only triggered by an alert while buffering in RAM. */
  recordingEnabled: boolean
  /** Per-mode master switch: turning a mode off skips both audio and photo. */
  evidenceModes: Record<Mode, boolean>
  recordingDir: string
  prerollSeconds: number
  postrollSeconds: number
  /** Evidence snapshot from the camera. */
  snapshotEnabled: boolean
  cameraId: string
  snapshotSize: SnapshotSize
  readoutAnimation: boolean
  rollingMs: number
  readoutIntervalMs: number
  emoji: EmojiSettings
  offset: number
  readingSmooth: boolean
  showPeak: boolean
  deviceId: string
  levels: Record<Mode, Level[]>
}

export function defaultSettings(): PersistedSettings {
  return {
    mode: 'forward',
    theme: DEFAULT_THEME,
    darkMode: DEFAULT_DARK_MODE,
    modeLabels: { ...DEFAULT_MODE_LABELS },
    idleNumberColor: '',
    statusColor: '',
    idleText: { ...DEFAULT_IDLE_TEXT },
    fullscreenTitle: DEFAULT_FULLSCREEN_TITLE,
    fullscreenSubtitle: DEFAULT_FULLSCREEN_SUBTITLE,
    fullscreenTitleFont: DEFAULT_TITLE_FONT,
    fullscreenTitleSize: DEFAULT_TITLE_SIZE,
    fullscreenTitleColor: DEFAULT_TITLE_COLOR,
    fullscreenSubtitleSize: DEFAULT_SUBTITLE_SIZE,
    fullscreenSubtitleColor: DEFAULT_SUBTITLE_COLOR,
    statusFont: DEFAULT_STATUS_FONT,
    statusSize: DEFAULT_STATUS_SIZE,
    recordingEnabled: DEFAULT_RECORDING_ENABLED,
    evidenceModes: { forward: true, reverse: true },
    recordingDir: '',
    prerollSeconds: DEFAULT_PREROLL_SECONDS,
    postrollSeconds: DEFAULT_POSTROLL_SECONDS,
    snapshotEnabled: DEFAULT_SNAPSHOT_ENABLED,
    cameraId: DEFAULT_CAMERA_ID,
    snapshotSize: DEFAULT_SNAPSHOT_SIZE,
    readoutAnimation: DEFAULT_READOUT_ANIMATION,
    rollingMs: DEFAULT_ROLLING_MS,
    readoutIntervalMs: DEFAULT_READOUT_INTERVAL_MS,
    emoji: {
      forward: { ...DEFAULT_EMOJI_SETTINGS.forward },
      reverse: { ...DEFAULT_EMOJI_SETTINGS.reverse },
    },
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

function sanitizeText(value: unknown, fallback: string, max: number, allowEmpty: boolean): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim().slice(0, max)
  return allowEmpty ? trimmed : trimmed.length > 0 ? trimmed : fallback
}

function sanitizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function sanitizeColorOrEmpty(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : ''
}

function sanitizeIdleText(value: unknown): Record<Mode, string> {
  const raw = isRecord(value) ? value : {}
  const pick = (mode: Mode): string => {
    const text = raw[mode]
    if (typeof text !== 'string') return DEFAULT_IDLE_TEXT[mode]
    const trimmed = text.trim().slice(0, IDLE_TEXT_MAX)
    return trimmed || DEFAULT_IDLE_TEXT[mode]
  }
  return { forward: pick('forward'), reverse: pick('reverse') }
}

function sanitizeEmojiRule(value: unknown, fallback: EmojiRule): EmojiRule {
  const raw = isRecord(value) ? value : {}
  return {
    enabled: raw.enabled !== false,
    threshold: sanitizeNumber(
      raw.threshold,
      fallback.threshold,
      EMOJI_THRESHOLD_MIN,
      EMOJI_THRESHOLD_MAX,
    ),
    holdSeconds: sanitizeNumber(raw.holdSeconds, fallback.holdSeconds, EMOJI_HOLD_MIN, EMOJI_HOLD_MAX),
    initial: sanitizeNumber(raw.initial, fallback.initial, EMOJI_INITIAL_MIN, EMOJI_INITIAL_MAX),
  }
}

function sanitizeEmoji(value: unknown): EmojiSettings {
  const raw = isRecord(value) ? value : {}
  return {
    forward: sanitizeEmojiRule(raw.forward, DEFAULT_EMOJI_SETTINGS.forward),
    reverse: sanitizeEmojiRule(raw.reverse, DEFAULT_EMOJI_SETTINGS.reverse),
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
    theme: isThemeId(value.theme) ? value.theme : DEFAULT_THEME,
    darkMode: value.darkMode === true,
    modeLabels: sanitizeModeLabels(value.modeLabels),
    idleNumberColor: sanitizeColorOrEmpty(value.idleNumberColor),
    statusColor: sanitizeColorOrEmpty(value.statusColor),
    idleText: sanitizeIdleText(value.idleText),
    fullscreenTitle: sanitizeText(
      value.fullscreenTitle,
      DEFAULT_FULLSCREEN_TITLE,
      FULLSCREEN_TITLE_MAX,
      false,
    ),
    fullscreenSubtitle: sanitizeText(
      value.fullscreenSubtitle,
      DEFAULT_FULLSCREEN_SUBTITLE,
      FULLSCREEN_SUBTITLE_MAX,
      true,
    ),
    fullscreenTitleFont: isKnownTitleFont(value.fullscreenTitleFont)
      ? value.fullscreenTitleFont
      : DEFAULT_TITLE_FONT,
    fullscreenTitleSize: sanitizeNumber(
      value.fullscreenTitleSize,
      DEFAULT_TITLE_SIZE,
      TITLE_SIZE_MIN,
      TITLE_SIZE_MAX,
    ),
    fullscreenTitleColor:
      typeof value.fullscreenTitleColor === 'string' &&
      /^#[0-9a-f]{6}$/i.test(value.fullscreenTitleColor)
        ? value.fullscreenTitleColor
        : DEFAULT_TITLE_COLOR,
    fullscreenSubtitleSize: sanitizeNumber(
      value.fullscreenSubtitleSize,
      DEFAULT_SUBTITLE_SIZE,
      SUBTITLE_SIZE_MIN,
      SUBTITLE_SIZE_MAX,
    ),
    fullscreenSubtitleColor:
      typeof value.fullscreenSubtitleColor === 'string' &&
      /^#[0-9a-f]{6}$/i.test(value.fullscreenSubtitleColor)
        ? value.fullscreenSubtitleColor
        : DEFAULT_SUBTITLE_COLOR,
    statusFont: isKnownTitleFont(value.statusFont) ? value.statusFont : DEFAULT_STATUS_FONT,
    statusSize: sanitizeNumber(value.statusSize, DEFAULT_STATUS_SIZE, STATUS_SIZE_MIN, STATUS_SIZE_MAX),
    recordingEnabled: value.recordingEnabled !== false,
    evidenceModes: {
      forward: (isRecord(value.evidenceModes) ? value.evidenceModes.forward : undefined) !== false,
      reverse: (isRecord(value.evidenceModes) ? value.evidenceModes.reverse : undefined) !== false,
    },
    recordingDir: typeof value.recordingDir === 'string' ? value.recordingDir.trim() : '',
    prerollSeconds: sanitizeNumber(value.prerollSeconds, DEFAULT_PREROLL_SECONDS, PREROLL_MIN, PREROLL_MAX),
    postrollSeconds: sanitizeNumber(value.postrollSeconds, DEFAULT_POSTROLL_SECONDS, POSTROLL_MIN, POSTROLL_MAX),
    snapshotEnabled: value.snapshotEnabled === true,
    cameraId: typeof value.cameraId === 'string' ? value.cameraId.trim() : DEFAULT_CAMERA_ID,
    snapshotSize:
      typeof value.snapshotSize === 'string' && value.snapshotSize in SNAPSHOT_SIZES
        ? (value.snapshotSize as SnapshotSize)
        : DEFAULT_SNAPSHOT_SIZE,
    readoutAnimation: value.readoutAnimation !== false,
    rollingMs: sanitizeNumber(value.rollingMs, DEFAULT_ROLLING_MS, ROLLING_MS_MIN, ROLLING_MS_MAX),
    readoutIntervalMs: sanitizeNumber(
      value.readoutIntervalMs,
      DEFAULT_READOUT_INTERVAL_MS,
      READOUT_INTERVAL_MIN,
      READOUT_INTERVAL_MAX,
    ),
    emoji: sanitizeEmoji(value.emoji),
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
