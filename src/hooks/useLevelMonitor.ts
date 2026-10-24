import { useCallback, useEffect, useRef } from 'react'
import { AudioEngine } from '../lib/audio/capture'
import { frameAverage, rmsToDb, tauForMode, timeWeight } from '../lib/dsp'
import { useLevelStore } from '../stores/level'
import { useSettingsStore } from '../stores/settings'

const PEAK_WINDOW_MS = 3000
const HISTORY_INTERVAL_MS = 100

/**
 * Owns the audio engine and turns its raw RMS samples into the smoothed reading
 * shown by the UI. Frame EMA + display time weighting mirror the reference
 * implementation (0.72 / 0.28 plus 125 ms / 1 s / 3 s integration).
 */
export function useLevelMonitor() {
  const engineRef = useRef<AudioEngine | null>(null)
  const frameRef = useRef(Number.NaN)
  const weightedRef = useRef(Number.NaN)
  const lastTsRef = useRef(0)
  const peakRef = useRef<Array<{ t: number; db: number }>>([])
  const lastHistoryRef = useRef(0)

  const getEngine = useCallback((): AudioEngine => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine(
        (sample) => {
          const settings = useSettingsStore.getState()
          const rawDb = rmsToDb(sample.rms, settings.offset)

          frameRef.current = frameAverage(frameRef.current, rawDb)
          const dt = lastTsRef.current === 0 ? 33 : sample.t - lastTsRef.current
          lastTsRef.current = sample.t

          const tau = tauForMode(settings.mode, settings.readingSmooth)
          weightedRef.current = timeWeight(weightedRef.current, frameRef.current, dt, tau)
          const db = weightedRef.current

          const peaks = peakRef.current
          peaks.push({ t: sample.t, db })
          while (peaks.length > 0 && sample.t - peaks[0].t > PEAK_WINDOW_MS) peaks.shift()
          let peak = db
          for (const entry of peaks) {
            if (entry.db > peak) peak = entry.db
          }

          const store = useLevelStore.getState()
          store.setReading({ db, peak, rawDb })

          if (sample.t - lastHistoryRef.current >= HISTORY_INTERVAL_MS) {
            lastHistoryRef.current = sample.t
            store.pushHistory(db)
          }
        },
        (status, error) => {
          const store = useLevelStore.getState()
          store.setStatus(status, error ?? null)
          if (status === 'running' && engineRef.current) {
            store.setDeviceLabel(engineRef.current.trackLabel || '默认麦克风')
            store.setConstraintFallback(engineRef.current.constraintFallback)
          }
          if (status === 'error' || status === 'idle') {
            frameRef.current = Number.NaN
            weightedRef.current = Number.NaN
            lastTsRef.current = 0
            peakRef.current = []
          }
        },
      )
    }
    return engineRef.current
  }, [])

  const start = useCallback(async (): Promise<void> => {
    const engine = getEngine()
    if (engine.isRunning) {
      if (engine.contextState === 'suspended') await engine.resume()
      return
    }
    const { deviceId } = useSettingsStore.getState()
    await engine.start({ deviceId })
  }, [getEngine])

  const stop = useCallback((): void => {
    engineRef.current?.stop()
    useLevelStore.getState().clearHistory()
  }, [])

  const toggle = useCallback(async (): Promise<void> => {
    const engine = getEngine()
    if (engine.isRunning && engine.contextState === 'running') {
      stop()
    } else {
      await start()
    }
  }, [getEngine, start, stop])

  // Start once on mount. A suspended AudioContext (first launch, no gesture yet)
  // surfaces as status 'suspended' and the UI asks for one click.
  useEffect(() => {
    let cancelled = false
    const engine = getEngine()
    const timer = window.setTimeout(() => {
      if (cancelled) return
      if (engine.isRunning) return
      void engine.start({ deviceId: useSettingsStore.getState().deviceId })
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      engine.stop()
      engineRef.current = null
    }
  }, [getEngine])

  return { start, stop, toggle }
}
