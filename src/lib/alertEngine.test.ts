import { describe, expect, it } from 'vitest'
import { AlertEngine } from './alertEngine'
import { defaultLevels } from './presets'

const forward = defaultLevels('forward')
const reverse = defaultLevels('reverse')

const STEP = 33

/** Feed a constant dB value for `ms` milliseconds and return the collected events. */
function hold(engine: AlertEngine, mode: 'forward' | 'reverse', db: number, start: number, ms: number) {
  const levels = mode === 'forward' ? forward : reverse
  const events = []
  let active = null
  for (let t = start; t < start + ms; t += STEP) {
    const update = engine.update(mode, levels, db, t)
    active = update.active
    events.push(...update.events)
  }
  return { active, events, end: start + ms }
}

describe('AlertEngine – forward (too loud)', () => {
  it('does not fire before the dwell time', () => {
    const engine = new AlertEngine()
    const short = hold(engine, 'forward', 70, 1000, 1900)
    expect(short.active).toBeNull()
    expect(short.events).toHaveLength(0)
  })

  it('fires after the dwell time', () => {
    const engine = new AlertEngine()
    const result = hold(engine, 'forward', 70, 1000, 2200)
    expect(result.active?.threshold).toBe(65)
    expect(result.events).toHaveLength(1)
    expect(result.events[0].type).toBe('enter')
  })

  it('holds when the reading dips within the hysteresis band', () => {
    const engine = new AlertEngine()
    const entered = hold(engine, 'forward', 70, 1000, 2200)
    expect(entered.active?.threshold).toBe(65)

    // 63 dB is below the 65 dB threshold but inside the 3 dB margin.
    const dip = hold(engine, 'forward', 63, entered.end, 2000)
    expect(dip.active?.threshold).toBe(65)
    expect(dip.events.filter((e) => e.type === 'exit')).toHaveLength(0)
  })

  it('releases only after the exit dwell once the reading recovers', () => {
    const engine = new AlertEngine()
    const entered = hold(engine, 'forward', 70, 1000, 2200)

    const brief = hold(engine, 'forward', 55, entered.end, 800)
    expect(brief.active?.threshold).toBe(65)

    const released = hold(engine, 'forward', 55, brief.end, 400)
    expect(released.active).toBeNull()
    expect(released.events.filter((e) => e.type === 'exit')).toHaveLength(1)
  })

  it('promotes to a more severe level only after another dwell', () => {
    const engine = new AlertEngine()
    const low = hold(engine, 'forward', 70, 1000, 2200)
    expect(low.active?.threshold).toBe(65)

    const spike = hold(engine, 'forward', 80, low.end, 1000)
    expect(spike.active?.threshold).toBe(65)

    const promoted = hold(engine, 'forward', 80, spike.end, 1300)
    expect(promoted.active?.threshold).toBe(75)
    const types = promoted.events.map((e) => e.type)
    expect(types).toEqual(['exit', 'enter'])
  })

  it('resets cleanly', () => {
    const engine = new AlertEngine()
    hold(engine, 'forward', 90, 1000, 2200)
    expect(engine.current?.threshold).toBe(85)
    engine.reset()
    expect(engine.current).toBeNull()
  })
})

describe('AlertEngine – reverse (too quiet)', () => {
  it('fires below the threshold', () => {
    const engine = new AlertEngine()
    const result = hold(engine, 'reverse', 45, 1000, 2200)
    expect(result.active?.threshold).toBe(50)
  })

  it('keeps the level inside the hysteresis band', () => {
    const engine = new AlertEngine()
    const entered = hold(engine, 'reverse', 45, 1000, 2200)
    expect(entered.active?.threshold).toBe(50)

    // 52 dB is above the 50 dB threshold but inside the 3 dB margin.
    const dip = hold(engine, 'reverse', 52, entered.end, 2000)
    expect(dip.active?.threshold).toBe(50)
  })

  it('releases when the reading clearly rises', () => {
    const engine = new AlertEngine()
    const entered = hold(engine, 'reverse', 45, 1000, 2200)
    const released = hold(engine, 'reverse', 70, entered.end, 1200)
    expect(released.active).toBeNull()
    expect(released.events.filter((e) => e.type === 'exit')).toHaveLength(1)
  })

  it('does not fire when the room is loud enough', () => {
    const engine = new AlertEngine()
    const result = hold(engine, 'reverse', 75, 1000, 3000)
    expect(result.active).toBeNull()
    expect(result.events).toHaveLength(0)
  })
})

describe('AlertEngine – configuration', () => {
  it('honours a custom dwell', () => {
    const engine = new AlertEngine({ dwellMs: 500 })
    const result = hold(engine, 'forward', 70, 1000, 600)
    expect(result.active?.threshold).toBe(65)
  })

  it('ignores disabled levels for activation', () => {
    const engine = new AlertEngine()
    const disabled = forward.map((level) => ({ ...level, enabled: false }))
    let active = null
    for (let t = 1000; t < 4000; t += STEP) {
      active = engine.update('forward', disabled, 100, t).active
    }
    expect(active).toBeNull()
  })

  it('drops an active level that got disabled mid-flight', () => {
    const engine = new AlertEngine()
    const entered = hold(engine, 'forward', 70, 1000, 2200)
    expect(entered.active?.threshold).toBe(65)

    const disabled = forward.map((level) => ({ ...level, enabled: false }))
    const update = engine.update('forward', disabled, 70, entered.end)
    expect(update.active).toBeNull()
    expect(update.events[0]?.type).toBe('exit')
  })
})
