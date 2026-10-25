import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultLevels } from '../lib/presets'
import {
  MAX_LEVELS,
  SETTINGS_VERSION,
  defaultSettings,
  migrateSettings,
  type EmojiRule,
  type EmojiSettings,
  type PersistedSettings,
  type SnapshotSize,
} from '../lib/settingsSchema'
import type { Level, Mode } from '../lib/types'
import type { ThemeId } from '../lib/theme'

export interface SettingsState {
  mode: Mode
  /** Colour theme + light/dark appearance. */
  theme: ThemeId
  darkMode: boolean
  /** User-facing name for each mode (e.g. 自习课模式 / 早读模式). */
  modeLabels: Record<Mode, string>
  idleNumberColor: string
  statusColor: string
  idleText: Record<Mode, string>
  levelNameSize: number
  levelNoteSize: number
  /** Title / subtitle shown in the top-left corner of fullscreen mode. */
  fullscreenTitle: string
  fullscreenSubtitle: string
  fullscreenTitleFont: string
  fullscreenTitleSize: number
  fullscreenTitleColor: string
  fullscreenSubtitleSize: number
  fullscreenSubtitleColor: string
  /** Fullscreen status line typography. */
  statusFont: string
  statusSize: number
  /** Evidence recording time machine. */
  recordingEnabled: boolean
  evidenceModes: Record<Mode, boolean>
  recordingDir: string
  prerollSeconds: number
  postrollSeconds: number
  snapshotEnabled: boolean
  cameraId: string
  snapshotSize: SnapshotSize
  /** Readout animation: rolling digits on/off, roll duration, refresh interval. */
  readoutAnimation: boolean
  rollingMs: number
  readoutIntervalMs: number
  /** Fullscreen emoji reward rules, per mode. */
  emoji: EmojiSettings
  offset: number
  /** Reverse mode only: smooth over ~3 s so reading aloud does not flicker. */
  readingSmooth: boolean
  showPeak: boolean
  /** 'default' follows the system default input device. */
  deviceId: string
  levels: Record<Mode, Level[]>

  setMode: (mode: Mode) => void
  setTheme: (theme: ThemeId) => void
  setDarkMode: (darkMode: boolean) => void
  setModeLabel: (mode: Mode, label: string) => void
  setIdleNumberColor: (color: string) => void
  setStatusColor: (color: string) => void
  setIdleText: (mode: Mode, text: string) => void
  setLevelNameSize: (size: number) => void
  setLevelNoteSize: (size: number) => void
  setEvidenceMode: (mode: Mode, enabled: boolean) => void
  setFullscreenTitle: (title: string) => void
  setFullscreenSubtitle: (subtitle: string) => void
  setFullscreenTitleFont: (font: string) => void
  setFullscreenTitleSize: (size: number) => void
  setFullscreenTitleColor: (color: string) => void
  setFullscreenSubtitleSize: (size: number) => void
  setFullscreenSubtitleColor: (color: string) => void
  setStatusFont: (font: string) => void
  setStatusSize: (size: number) => void
  setRecordingEnabled: (enabled: boolean) => void
  setRecordingDir: (dir: string) => void
  setPrerollSeconds: (seconds: number) => void
  setPostrollSeconds: (seconds: number) => void
  setSnapshotEnabled: (enabled: boolean) => void
  setCameraId: (cameraId: string) => void
  setSnapshotSize: (size: SnapshotSize) => void
  setReadoutAnimation: (enabled: boolean) => void
  setRollingMs: (value: number) => void
  setReadoutIntervalMs: (value: number) => void
  updateEmojiRule: (mode: Mode, patch: Partial<EmojiRule>) => void
  setOffset: (offset: number) => void
  setReadingSmooth: (value: boolean) => void
  setShowPeak: (value: boolean) => void
  setDeviceId: (deviceId: string) => void
  updateLevel: (mode: Mode, id: string, patch: Partial<Level>) => void
  addLevel: (mode: Mode) => void
  removeLevel: (mode: Mode, id: string) => void
  resetLevels: (mode: Mode) => void
  resetAll: () => void
}

function nextLevel(levels: Level[], mode: Mode): Level {
  const sorted = [...levels].sort((a, b) =>
    mode === 'forward' ? a.threshold - b.threshold : b.threshold - a.threshold,
  )
  const last = sorted[sorted.length - 1]
  const threshold = last
    ? mode === 'forward'
      ? Math.min(120, last.threshold + 10)
      : Math.max(0, last.threshold - 10)
    : mode === 'forward'
      ? 70
      : 50
  return {
    id: `${mode === 'forward' ? 'f' : 'r'}-${Date.now().toString(36)}`,
    threshold,
    name: `级别 ${levels.length + 1}`,
    note: mode === 'forward' ? '注意音量' : '再大声一点',
    color: mode === 'forward' ? '#DC2626' : '#D97706',
    enabled: true,
  }
}

const initial = defaultSettings()

export const useSettingsStore = create<SettingsState>()(
  persist<SettingsState, [], [], PersistedSettings>(
    (set) => ({
      mode: initial.mode,
      theme: initial.theme,
      darkMode: initial.darkMode,
      modeLabels: initial.modeLabels,
      idleNumberColor: initial.idleNumberColor,
      statusColor: initial.statusColor,
      idleText: initial.idleText,
      levelNameSize: initial.levelNameSize,
      levelNoteSize: initial.levelNoteSize,
      fullscreenTitle: initial.fullscreenTitle,
      fullscreenSubtitle: initial.fullscreenSubtitle,
      fullscreenTitleFont: initial.fullscreenTitleFont,
      fullscreenTitleSize: initial.fullscreenTitleSize,
      fullscreenTitleColor: initial.fullscreenTitleColor,
      fullscreenSubtitleSize: initial.fullscreenSubtitleSize,
      fullscreenSubtitleColor: initial.fullscreenSubtitleColor,
      statusFont: initial.statusFont,
      statusSize: initial.statusSize,
      recordingEnabled: initial.recordingEnabled,
      evidenceModes: initial.evidenceModes,
      recordingDir: initial.recordingDir,
      prerollSeconds: initial.prerollSeconds,
      postrollSeconds: initial.postrollSeconds,
      snapshotEnabled: initial.snapshotEnabled,
      cameraId: initial.cameraId,
      snapshotSize: initial.snapshotSize,
      readoutAnimation: initial.readoutAnimation,
      rollingMs: initial.rollingMs,
      readoutIntervalMs: initial.readoutIntervalMs,
      emoji: initial.emoji,
      offset: initial.offset,
      readingSmooth: initial.readingSmooth,
      showPeak: initial.showPeak,
      deviceId: initial.deviceId,
      levels: initial.levels,

      setMode: (mode) => set({ mode }),
      setTheme: (theme) => set({ theme }),
      setDarkMode: (darkMode) => set({ darkMode }),
      setIdleNumberColor: (idleNumberColor) => set({ idleNumberColor }),
      setStatusColor: (statusColor) => set({ statusColor }),
      setIdleText: (mode, text) =>
        set((state) => ({ idleText: { ...state.idleText, [mode]: text } })),
      setLevelNameSize: (levelNameSize) => set({ levelNameSize }),
      setLevelNoteSize: (levelNoteSize) => set({ levelNoteSize }),
      setEvidenceMode: (mode, enabled) =>
        set((state) => ({ evidenceModes: { ...state.evidenceModes, [mode]: enabled } })),
      setModeLabel: (mode, label) =>
        set((state) => ({ modeLabels: { ...state.modeLabels, [mode]: label } })),
      setFullscreenTitle: (fullscreenTitle) => set({ fullscreenTitle }),
      setFullscreenSubtitle: (fullscreenSubtitle) => set({ fullscreenSubtitle }),
      setFullscreenTitleFont: (fullscreenTitleFont) => set({ fullscreenTitleFont }),
      setFullscreenTitleSize: (fullscreenTitleSize) => set({ fullscreenTitleSize }),
      setFullscreenTitleColor: (fullscreenTitleColor) => set({ fullscreenTitleColor }),
      setFullscreenSubtitleSize: (fullscreenSubtitleSize) => set({ fullscreenSubtitleSize }),
      setFullscreenSubtitleColor: (fullscreenSubtitleColor) => set({ fullscreenSubtitleColor }),
      setStatusFont: (statusFont) => set({ statusFont }),
      setStatusSize: (statusSize) => set({ statusSize }),
      setRecordingEnabled: (recordingEnabled) => set({ recordingEnabled }),
      setRecordingDir: (recordingDir) => set({ recordingDir }),
      setPrerollSeconds: (prerollSeconds) => set({ prerollSeconds }),
      setPostrollSeconds: (postrollSeconds) => set({ postrollSeconds }),
      setSnapshotEnabled: (snapshotEnabled) => set({ snapshotEnabled }),
      setCameraId: (cameraId) => set({ cameraId }),
      setSnapshotSize: (snapshotSize) => set({ snapshotSize }),
      setReadoutAnimation: (readoutAnimation) => set({ readoutAnimation }),
      setRollingMs: (rollingMs) => set({ rollingMs }),
      setReadoutIntervalMs: (readoutIntervalMs) => set({ readoutIntervalMs }),
      updateEmojiRule: (mode, patch) =>
        set((state) => ({ emoji: { ...state.emoji, [mode]: { ...state.emoji[mode], ...patch } } })),
      setOffset: (offset) => set({ offset }),
      setReadingSmooth: (readingSmooth) => set({ readingSmooth }),
      setShowPeak: (showPeak) => set({ showPeak }),
      setDeviceId: (deviceId) => set({ deviceId }),

      updateLevel: (mode, id, patch) =>
        set((state) => ({
          levels: {
            ...state.levels,
            [mode]: state.levels[mode].map((level) =>
              level.id === id ? { ...level, ...patch } : level,
            ),
          },
        })),

      addLevel: (mode) =>
        set((state) => {
          if (state.levels[mode].length >= MAX_LEVELS) return state
          return {
            levels: {
              ...state.levels,
              [mode]: [...state.levels[mode], nextLevel(state.levels[mode], mode)],
            },
          }
        }),

      removeLevel: (mode, id) =>
        set((state) => {
          if (state.levels[mode].length <= 1) return state
          return {
            levels: {
              ...state.levels,
              [mode]: state.levels[mode].filter((level) => level.id !== id),
            },
          }
        }),

      resetLevels: (mode) =>
        set((state) => ({
          levels: { ...state.levels, [mode]: defaultLevels(mode) },
        })),

      resetAll: () => {
        const fresh = defaultSettings()
        set({
          mode: fresh.mode,
          theme: fresh.theme,
          darkMode: fresh.darkMode,
          modeLabels: fresh.modeLabels,
          idleNumberColor: fresh.idleNumberColor,
          statusColor: fresh.statusColor,
          idleText: fresh.idleText,
          levelNameSize: fresh.levelNameSize,
          levelNoteSize: fresh.levelNoteSize,
          fullscreenTitle: fresh.fullscreenTitle,
          fullscreenSubtitle: fresh.fullscreenSubtitle,
          fullscreenTitleFont: fresh.fullscreenTitleFont,
          fullscreenTitleSize: fresh.fullscreenTitleSize,
          fullscreenTitleColor: fresh.fullscreenTitleColor,
          fullscreenSubtitleSize: fresh.fullscreenSubtitleSize,
          fullscreenSubtitleColor: fresh.fullscreenSubtitleColor,
          statusFont: fresh.statusFont,
          statusSize: fresh.statusSize,
          recordingEnabled: fresh.recordingEnabled,
          evidenceModes: fresh.evidenceModes,
          recordingDir: fresh.recordingDir,
          prerollSeconds: fresh.prerollSeconds,
          postrollSeconds: fresh.postrollSeconds,
          snapshotEnabled: fresh.snapshotEnabled,
          cameraId: fresh.cameraId,
          snapshotSize: fresh.snapshotSize,
          readoutAnimation: fresh.readoutAnimation,
          rollingMs: fresh.rollingMs,
          readoutIntervalMs: fresh.readoutIntervalMs,
          emoji: fresh.emoji,
          offset: fresh.offset,
          readingSmooth: fresh.readingSmooth,
          showPeak: fresh.showPeak,
          deviceId: fresh.deviceId,
          levels: fresh.levels,
        })
      },
    }),
    {
      name: 'dbound.settings',
      version: SETTINGS_VERSION,
      migrate: (persisted, version) => migrateSettings(persisted, version),
      partialize: (state) => ({
        mode: state.mode,
        theme: state.theme,
        darkMode: state.darkMode,
        modeLabels: state.modeLabels,
        idleNumberColor: state.idleNumberColor,
        statusColor: state.statusColor,
        idleText: state.idleText,
        levelNameSize: state.levelNameSize,
        levelNoteSize: state.levelNoteSize,
        fullscreenTitle: state.fullscreenTitle,
        fullscreenSubtitle: state.fullscreenSubtitle,
        fullscreenTitleFont: state.fullscreenTitleFont,
        fullscreenTitleSize: state.fullscreenTitleSize,
        fullscreenTitleColor: state.fullscreenTitleColor,
        fullscreenSubtitleSize: state.fullscreenSubtitleSize,
        fullscreenSubtitleColor: state.fullscreenSubtitleColor,
        statusFont: state.statusFont,
        statusSize: state.statusSize,
        recordingEnabled: state.recordingEnabled,
        evidenceModes: state.evidenceModes,
        recordingDir: state.recordingDir,
        prerollSeconds: state.prerollSeconds,
        postrollSeconds: state.postrollSeconds,
        snapshotEnabled: state.snapshotEnabled,
        cameraId: state.cameraId,
        snapshotSize: state.snapshotSize,
        readoutAnimation: state.readoutAnimation,
        rollingMs: state.rollingMs,
        readoutIntervalMs: state.readoutIntervalMs,
        emoji: state.emoji,
        offset: state.offset,
        readingSmooth: state.readingSmooth,
        showPeak: state.showPeak,
        deviceId: state.deviceId,
        levels: state.levels,
      }),
    },
  ),
)
