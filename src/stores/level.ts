import { create } from 'zustand'
import type { CaptureError, CaptureStatus } from '../lib/types'

export interface LevelState {
  /** 0..120 estimated dB, or null while not measuring. */
  db: number | null
  peak: number | null
  rawDb: number | null
  status: CaptureStatus
  error: CaptureError | null
  deviceLabel: string
  constraintFallback: boolean
  /** dB values for the 60 s waveform, oldest first. */
  history: number[]

  setReading: (reading: { db: number; peak: number; rawDb: number }) => void
  setStatus: (status: CaptureStatus, error?: CaptureError | null) => void
  setDeviceLabel: (label: string) => void
  setConstraintFallback: (value: boolean) => void
  pushHistory: (db: number) => void
  clearHistory: () => void
  reset: () => void
}

const HISTORY_POINTS = 600

export const useLevelStore = create<LevelState>()((set) => ({
  db: null,
  peak: null,
  rawDb: null,
  status: 'idle',
  error: null,
  deviceLabel: '',
  constraintFallback: false,
  history: [],

  setReading: ({ db, peak, rawDb }) => set({ db, peak, rawDb }),

  setStatus: (status, error = null) =>
    set((state) => ({
      status,
      error: status === 'error' ? error : null,
      // Keep the last reading when paused (shown dimmed) but never when the mic failed.
      db: status === 'error' ? null : state.db,
      peak: status === 'error' ? null : state.peak,
    })),

  setDeviceLabel: (deviceLabel) => set({ deviceLabel }),
  setConstraintFallback: (constraintFallback) => set({ constraintFallback }),

  pushHistory: (db) =>
    set((state) => {
      const next = state.history.length >= HISTORY_POINTS
        ? state.history.slice(state.history.length - HISTORY_POINTS + 1)
        : state.history.slice()
      next.push(db)
      return { history: next }
    }),

  clearHistory: () => set({ history: [] }),

  reset: () =>
    set({
      db: null,
      peak: null,
      rawDb: null,
      status: 'idle',
      error: null,
      history: [],
    }),
}))
