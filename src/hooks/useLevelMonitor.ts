import { useCallback, useEffect, useRef } from 'react'
import { AlertEngine } from '../lib/alertEngine'
import { AudioEngine } from '../lib/audio/capture'
import { frameAverage, rmsToDb, tauForMode, timeWeight } from '../lib/dsp'
import { emitMiniState, listenMiniCommands } from '../lib/miniBridge'
import { logAlert, logDevice, logSample, logSystem } from '../lib/logger'
import { useLevelStore } from '../stores/level'
import { useSettingsStore } from '../stores/settings'

const PEAK_WINDOW_MS = 3000
const HISTORY_INTERVAL_MS = 100
const SAMPLE_STEP_MS = 33

/** `VITE_DBOUND_SIM=<db>` fakes the signal so the UI can be previewed without a mic. */
const SIM_DB = Number(import.meta.env.VITE_DBOUND_SIM)
const SIMULATION = Number.isFinite(SIM_DB) && SIM_DB > 0

/**
 * Owns the audio engine and turns raw RMS samples into the smoothed reading:
 * frame EMA (0.72/0.28, same as the reference monitor) → display time weighting
 * (125 ms / 1 s / 3 s) → alert engine (dwell + hysteresis) → stores.
 */
export function useLevelMonitor() {
  const audioRef = useRef<AudioEngine | null>(null)
  const alertRef = useRef<AlertEngine | null>(null)
  const frameRef = useRef(Number.NaN)
  const weightedRef = useRef(Number.NaN)
  const lastTsRef = useRef(0)
  const peakRef = useRef<Array<{ t: number; db: number }>>([])
  const lastHistoryRef = useRef(0)
  const lastMiniEmitRef = useRef(0)
  const lastSampleLogRef = useRef(0)

  const publishMiniState = useCallback(() => {
    const settings = useSettingsStore.getState()
    const level = useLevelStore.getState()
    const active = level.activeLevel
    void emitMiniState({
      db: level.db,
      peak: level.peak,
      color: active?.color ?? '#17171A',
      name: active?.name ?? null,
      mode: settings.mode,
      modeLabel: settings.modeLabels[settings.mode],
      title: settings.fullscreenTitle,
      subtitle: settings.fullscreenSubtitle,
      titleFont: settings.fullscreenTitleFont,
      titleSize: settings.fullscreenTitleSize,
      titleColor: settings.fullscreenTitleColor,
      subtitleSize: settings.fullscreenSubtitleSize,
      subtitleColor: settings.fullscreenSubtitleColor,
      readoutAnimation: settings.readoutAnimation,
      rollingMs: settings.rollingMs,
      readoutIntervalMs: settings.readoutIntervalMs,
      emojiRule: settings.emoji[settings.mode],
      running: level.status === 'running',
      paused: level.status === 'idle' || level.status === 'error',
    })
  }, [])

  const getAlert = useCallback((): AlertEngine => {
    if (!alertRef.current) alertRef.current = new AlertEngine()
    return alertRef.current
  }, [])

  const applyDb = useCallback(
    (rawDb: number, now: number) => {
      const settings = useSettingsStore.getState()

      frameRef.current = frameAverage(frameRef.current, rawDb)
      const dt = lastTsRef.current === 0 ? SAMPLE_STEP_MS : now - lastTsRef.current
      lastTsRef.current = now

      const tau = tauForMode(settings.mode, settings.readingSmooth)
      weightedRef.current = timeWeight(weightedRef.current, frameRef.current, dt, tau)
      const db = weightedRef.current

      const peaks = peakRef.current
      peaks.push({ t: now, db })
      while (peaks.length > 0 && now - peaks[0].t > PEAK_WINDOW_MS) peaks.shift()
      let peak = db
      for (const entry of peaks) {
        if (entry.db > peak) peak = entry.db
      }

      const store = useLevelStore.getState()
      store.setReading({ db, peak, rawDb })

      const update = getAlert().update(settings.mode, settings.levels[settings.mode], db, now)
      if (store.activeLevel !== update.active) store.setActiveLevel(update.active)
      for (const event of update.events) {
        store.pushAlertEvent(event)
        logAlert(event.type, event.level.name, event.db)
      }

      if (now - lastHistoryRef.current >= HISTORY_INTERVAL_MS) {
        lastHistoryRef.current = now
        store.pushHistory(db)
      }

      // One log sample per second keeps the JSONL small while still describing the day.
      if (now - lastSampleLogRef.current >= 1000) {
        lastSampleLogRef.current = now
        logSample(db, update.active?.name ?? null)
      }

      // The mini capsule window lives in a separate webview, so it gets the
      // reading through a Tauri event at ~10 Hz.
      if (now - lastMiniEmitRef.current >= 100) {
        lastMiniEmitRef.current = now
        publishMiniState()
      }
    },
    [getAlert, publishMiniState],
  )

  const getAudio = useCallback((): AudioEngine => {
    if (!audioRef.current) {
      audioRef.current = new AudioEngine(
        (sample) => {
          const { offset } = useSettingsStore.getState()
          applyDb(rmsToDb(sample.rms, offset), sample.t)
        },
        (status, error) => {
          const store = useLevelStore.getState()
          store.setStatus(status, error ?? null)
          if (status === 'running' && audioRef.current) {
            store.setDeviceLabel(audioRef.current.trackLabel || '默认麦克风')
            store.setConstraintFallback(audioRef.current.constraintFallback)
            logSystem(`开始测量 · ${audioRef.current.trackLabel || '默认麦克风'}`)
          }
          if (status === 'error') {
            logDevice(`采集失败：${error?.code ?? 'unknown'} ${error?.message ?? ''}`.trim())
          }
          if (status === 'idle') {
            logSystem('暂停测量（麦克风已释放）')
          }
          if (status === 'error' || status === 'idle') {
            frameRef.current = Number.NaN
            weightedRef.current = Number.NaN
            lastTsRef.current = 0
            peakRef.current = []
            getAlert().reset()
            store.setActiveLevel(null)
          }
          publishMiniState()
        },
      )
    }
    return audioRef.current
  }, [applyDb, getAlert, publishMiniState])

  const start = useCallback(async (): Promise<void> => {
    if (SIMULATION) return
    const audio = getAudio()
    if (audio.isRunning) {
      if (audio.contextState === 'suspended') await audio.resume()
      return
    }
    const { deviceId } = useSettingsStore.getState()
    await audio.start({ deviceId })
  }, [getAudio])

  const stop = useCallback((): void => {
    audioRef.current?.stop()
    getAlert().reset()
    useLevelStore.getState().clearHistory()
    useLevelStore.getState().setActiveLevel(null)
    publishMiniState()
  }, [getAlert, publishMiniState])

  const toggle = useCallback(async (): Promise<void> => {
    if (SIMULATION) return
    const audio = getAudio()
    if (audio.isRunning && audio.contextState === 'running') {
      stop()
    } else {
      await start()
    }
  }, [getAudio, start, stop])

  /** Switch input device and rebuild the capture chain (also used by settings). */
  const restartDevice = useCallback(
    async (deviceId: string): Promise<void> => {
      if (SIMULATION) return
      const audio = getAudio()
      audio.stop()
      getAlert().reset()
      useLevelStore.getState().setActiveLevel(null)
      await audio.start({ deviceId })
    },
    [getAlert, getAudio],
  )

  // Reset the alert state whenever the mode changes.
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe((state, previous) => {
      if (state.mode !== previous.mode) {
        getAlert().reset()
        useLevelStore.getState().setActiveLevel(null)
        logSystem(`切换到${state.modeLabels[state.mode]}`)
        publishMiniState()
      }
    })
    return unsubscribe
  }, [getAlert, publishMiniState])

  // The mini window asks for a fresh snapshot right after it opens.
  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined
    void listenMiniCommands((command) => {
      if (command === 'mini-ready') publishMiniState()
    }).then((fn) => {
      if (disposed) fn()
      else unlisten = fn
    })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [publishMiniState])

  // Start once on mount. A suspended AudioContext (first launch, no gesture yet)
  // surfaces as status 'suspended' and the UI asks for one click.
  useEffect(() => {
    if (SIMULATION) return
    let cancelled = false
    const audio = getAudio()
    const timer = window.setTimeout(() => {
      if (cancelled) return
      if (audio.isRunning) return
      void audio.start({ deviceId: useSettingsStore.getState().deviceId })
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      audio.stop()
      audioRef.current = null
    }
  }, [getAudio])

  // Synthetic signal for UI previews and screenshots (no microphone involved).
  useEffect(() => {
    if (!SIMULATION) return
    const store = useLevelStore.getState()
    store.setStatus('running')
    store.setDeviceLabel('演示信号（未使用麦克风）')
    logSystem('开始测量 · 演示信号（未使用麦克风）')

    const simulatedMode = import.meta.env.VITE_DBOUND_SIM_MODE
    if (simulatedMode === 'forward' || simulatedMode === 'reverse') {
      useSettingsStore.getState().setMode(simulatedMode)
    }

    const startedAt = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const elapsed = now - startedAt
      const value = SIM_DB + Math.sin(elapsed / 900) * 4 + Math.sin(elapsed / 210) * 1.5
      applyDb(value, now)
    }, SAMPLE_STEP_MS)
    return () => window.clearInterval(timer)
  }, [applyDb])

  return { start, stop, toggle, restartDevice }
}
