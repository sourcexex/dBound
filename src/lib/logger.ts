import { isTauri } from './tauri'

export type LogKind = 'alert' | 'device' | 'system' | 'sample'

export interface LogEntry {
  /** Unix epoch milliseconds. */
  ts: number
  kind: LogKind
  level: string | null
  db: number | null
  text: string
  /** Local calendar day, also the file name on disk. */
  day: string
}

const FLUSH_DELAY_MS = 4000
const FLUSH_THRESHOLD = 25

const buffer: LogEntry[] = []
let timer = 0
let flushing = false

function localDay(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

async function flush(): Promise<void> {
  if (timer) {
    window.clearTimeout(timer)
    timer = 0
  }
  if (buffer.length === 0 || flushing) return

  flushing = true
  const batch = buffer.splice(0, buffer.length)
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('log_append', { entries: batch })
  } catch {
    // Logging must never break monitoring; dropping a batch is acceptable.
  } finally {
    flushing = false
    if (buffer.length > 0) scheduleFlush()
  }
}

function scheduleFlush(delay = FLUSH_DELAY_MS): void {
  if (timer) return
  timer = window.setTimeout(() => {
    timer = 0
    void flush()
  }, delay)
}

function push(entry: Omit<LogEntry, 'ts' | 'day'> & { ts?: number; day?: string }): void {
  if (!isTauri()) return
  const now = entry.ts ?? Date.now()
  buffer.push({ ...entry, ts: now, day: entry.day ?? localDay(new Date(now)) })
  if (buffer.length >= FLUSH_THRESHOLD) void flush()
  else scheduleFlush()
}

export function logAlert(phase: 'enter' | 'exit', levelName: string, db: number): void {
  push({
    kind: 'alert',
    level: levelName,
    db,
    text: phase === 'enter' ? '触发提醒' : '解除提醒',
  })
}

export function logSystem(text: string): void {
  push({ kind: 'system', level: null, db: null, text })
}

export function logDevice(text: string): void {
  push({ kind: 'device', level: null, db: null, text })
}

export function logSample(db: number, levelName: string | null): void {
  push({ kind: 'sample', level: levelName, db, text: levelName ? `命中「${levelName}」` : '' })
}

/** Force a flush (used when the window is going away or the log page opens). */
export function flushLogs(): void {
  void flush()
}

export function initLogFlushHooks(): () => void {
  const onHide = () => flushLogs()
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flushLogs()
  }
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    window.removeEventListener('pagehide', onHide)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

export { localDay }
