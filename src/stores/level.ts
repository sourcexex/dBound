import { create } from 'zustand'
import type { AlertEvent } from '../lib/alertEngine'
import type { CaptureError, CaptureStatus, Level } from '../lib/types'

const HISTORY_POINTS = 600
const EVENT_POINTS = 200

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
  /** Level currently shown by the alert engine (already debounced). */
  activeLevel: Level | null
  /** Recent enter/exit transitions, newest last. */
  events: AlertEvent[]
  /** Alerts seen since the log page was opened last. */
  unseenAlerts: number

  setReading: (reading: { db: number; peak: number; rawDb: number }) => void
  setStatus: (status: CaptureStatus, error?: CaptureError | null) => void
  setDeviceLabel: (label: string) => void
  setConstraintFallback: (value: boolean) => void
  pushHistory: (db: number) => void
  clearHistory: () => void
  setActiveLevel: (level: Level | null) => void
  pushAlertEvent: (event: AlertEvent) => void
  clearUnseenAlerts: () => void
  reset: () => void
}

export const useLevelStore = create<LevelState>()((set) => ({
  db: null,
  peak: null,
  rawDb: null,
  status: 'idle',
  error: null,
  deviceLabel: '',
  constraintFallback: false,
  history: [],
  activeLevel: null,
  events: [],
  unseenAlerts: 0,

  setReading: ({ db, peak, rawDb }) => set({ db, peak, rawDb }),

  setStatus: (status, error = null) =>
    set((state) => ({
      status,
      error: status === 'error' ? error : null,
      // Keep the last reading when paused (shown dimmed) but never when the mic failed.
      db: status === 'error' ? null : state.db,
      peak: status === 'error' ? null : state.peak,
      activeLevel: status === 'error' ? null : state.activeLevel,
    })),

  setDeviceLabel: (deviceLabel) => set({ deviceLabel }),
  setConstraintFallback: (constraintFallback) => set({ constraintFallback }),

  pushHistory: (db) =>
    set((state) => {
      const next =
        state.history.length >= HISTORY_POINTS
          ? state.history.slice(state.history.length - HISTORY_POINTS + 1)
          : state.history.slice()
      next.push(db)
      return { history: next }
    }),

  clearHistory: () => set({ history: [] }),

  setActiveLevel: (activeLevel) => set({ activeLevel }),

  pushAlertEvent: (event) =>
    set((state) => {
      const next =
        state.events.length >= EVENT_POINTS
          ? state.events.slice(state.events.length - EVENT_POINTS + 1)
          : state.events.slice()
      next.push(event)
      return { events: next, unseenAlerts: state.unseenAlerts + 1 }
    }),

  clearUnseenAlerts: () => set({ unseenAlerts: 0 }),

  reset: () =>
    set({
      db: null,
      peak: null,
      rawDb: null,
      status: 'idle',
      error: null,
      history: [],
      activeLevel: null,
    }),
}))
