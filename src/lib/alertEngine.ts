import { pickActiveLevel } from './dsp'
import type { Level, Mode } from './types'

export interface AlertEvent {
  type: 'enter' | 'exit'
  level: Level
  db: number
  /** performance.now() timestamp of the transition. */
  at: number
}

export interface AlertUpdate {
  active: Level | null
  events: AlertEvent[]
}

export interface AlertEngineOptions {
  /** How long a level must stay triggered before it becomes active. */
  dwellMs?: number
  /** How long the reading must stay back inside the band before the level clears. */
  exitDwellMs?: number
  /** Extra dB the reading must recover before the level counts as cleared. */
  hysteresis?: number
}

export const DEFAULT_DWELL_MS = 2000
export const DEFAULT_EXIT_DWELL_MS = 1000
export const DEFAULT_HYSTERESIS = 3

/**
 * Stateful alert engine.
 *
 * Three layers of debouncing keep the UI from flickering:
 *  1. `dwell` – a level only becomes active after it has been exceeded continuously.
 *  2. `hysteresis` – clearing a level requires the reading to move back past the
 *     threshold by a margin, so a reading sitting on the line cannot flap.
 *  3. `exitDwell` – the level must stay cleared for a while before it releases.
 *
 * Switching between levels (e.g. 注意 -> 警告) also goes through `dwell`, so a
 * single loud spike cannot promote the alarm.
 */
export class AlertEngine {
  private readonly dwellMs: number
  private readonly exitDwellMs: number
  private readonly hysteresis: number

  private activeId: string | null = null
  private activeLevel: Level | null = null
  private candidateId: string | null = null
  private candidateSince: number | null = null
  private exitSince: number | null = null

  constructor(options: AlertEngineOptions = {}) {
    this.dwellMs = options.dwellMs ?? DEFAULT_DWELL_MS
    this.exitDwellMs = options.exitDwellMs ?? DEFAULT_EXIT_DWELL_MS
    this.hysteresis = options.hysteresis ?? DEFAULT_HYSTERESIS
  }

  get current(): Level | null {
    return this.activeLevel
  }

  reset(): void {
    this.activeId = null
    this.activeLevel = null
    this.candidateId = null
    this.candidateSince = null
    this.exitSince = null
  }

  update(mode: Mode, levels: Level[], db: number, now: number): AlertUpdate {
    const events: AlertEvent[] = []
    const candidate = pickActiveLevel(mode, levels, db)

    if (this.activeId !== null) {
      // Pick up edits to the active level, and drop it if it was disabled or deleted.
      const current = levels.find((level) => level.id === this.activeId && level.enabled) ?? null
      if (!current) {
        this.release(events, db, now, null)
        return { active: null, events }
      }
      this.activeLevel = current

      if (candidate && candidate.id === current.id) {
        this.candidateId = null
        this.candidateSince = null
        this.exitSince = null
        return { active: current, events }
      }

      // Has the reading recovered past the hysteresis margin?
      const recovered =
        mode === 'forward'
          ? db < current.threshold - this.hysteresis
          : db > current.threshold + this.hysteresis

      if (recovered) {
        if (this.exitSince === null) this.exitSince = now
        if (now - this.exitSince >= this.exitDwellMs) {
          this.release(events, db, now, null)
          return { active: null, events }
        }
        return { active: current, events }
      }

      this.exitSince = null

      // A different level is triggered: promote/demote only after its own dwell.
      if (candidate) {
        if (this.candidateId !== candidate.id) {
          this.candidateId = candidate.id
          this.candidateSince = now
        }
        if (this.candidateSince !== null && now - this.candidateSince >= this.dwellMs) {
          this.release(events, db, now, candidate)
          return { active: candidate, events }
        }
      }

      return { active: current, events }
    }

    if (!candidate) {
      this.candidateId = null
      this.candidateSince = null
      this.exitSince = null
      return { active: null, events }
    }

    if (this.candidateId !== candidate.id) {
      this.candidateId = candidate.id
      this.candidateSince = now
    }
    if (this.candidateSince !== null && now - this.candidateSince >= this.dwellMs) {
      this.activeId = candidate.id
      this.activeLevel = candidate
      this.candidateId = null
      this.candidateSince = null
      this.exitSince = null
      events.push({ type: 'enter', level: candidate, db, at: now })
      return { active: candidate, events }
    }

    return { active: null, events }
  }

  private release(events: AlertEvent[], db: number, now: number, next: Level | null): void {
    if (this.activeLevel) {
      events.push({ type: 'exit', level: this.activeLevel, db, at: now })
    }
    this.activeId = next ? next.id : null
    this.activeLevel = next
    this.candidateId = null
    this.candidateSince = null
    this.exitSince = null
    if (next) {
      events.push({ type: 'enter', level: next, db, at: now })
    }
  }
}
