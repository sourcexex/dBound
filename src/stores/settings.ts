import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultLevels } from '../lib/presets'
import {
  MAX_LEVELS,
  SETTINGS_VERSION,
  defaultSettings,
  migrateSettings,
  type PersistedSettings,
} from '../lib/settingsSchema'
import type { Level, Mode } from '../lib/types'

export interface SettingsState {
  mode: Mode
  offset: number
  /** Reverse mode only: smooth over ~3 s so reading aloud does not flicker. */
  readingSmooth: boolean
  showPeak: boolean
  /** 'default' follows the system default input device. */
  deviceId: string
  levels: Record<Mode, Level[]>

  setMode: (mode: Mode) => void
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
      offset: initial.offset,
      readingSmooth: initial.readingSmooth,
      showPeak: initial.showPeak,
      deviceId: initial.deviceId,
      levels: initial.levels,

      setMode: (mode) => set({ mode }),
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
        offset: state.offset,
        readingSmooth: state.readingSmooth,
        showPeak: state.showPeak,
        deviceId: state.deviceId,
        levels: state.levels,
      }),
    },
  ),
)
