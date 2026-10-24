import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_OFFSET } from '../lib/dsp'
import { defaultLevels } from '../lib/presets'
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

const MAX_LEVELS = 8

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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      mode: 'forward',
      offset: DEFAULT_OFFSET,
      readingSmooth: true,
      showPeak: true,
      deviceId: 'default',
      levels: {
        forward: defaultLevels('forward'),
        reverse: defaultLevels('reverse'),
      },

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

      resetAll: () =>
        set({
          mode: 'forward',
          offset: DEFAULT_OFFSET,
          readingSmooth: true,
          showPeak: true,
          deviceId: 'default',
          levels: {
            forward: defaultLevels('forward'),
            reverse: defaultLevels('reverse'),
          },
        }),
    }),
    {
      name: 'dbound.settings',
      version: 1,
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
