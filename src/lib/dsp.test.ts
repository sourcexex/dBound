import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OFFSET,
  clamp,
  frameAverage,
  pickActiveLevel,
  rmsToDb,
  rmsToDbfs,
  sortLevels,
  tauForMode,
  timeWeight,
  validateLevels,
} from './dsp'
import { defaultLevels } from './presets'
import type { Level, Mode } from './types'

const forward = defaultLevels('forward')
const reverse = defaultLevels('reverse')

function level(threshold: number, enabled = true): Level {
  return { id: `l-${threshold}`, threshold, name: String(threshold), note: '', color: '#000000', enabled }
}

describe('db conversion', () => {
  it('maps full-scale RMS to the calibration offset', () => {
    expect(rmsToDbfs(1)).toBeCloseTo(0, 5)
    expect(rmsToDb(1, DEFAULT_OFFSET)).toBeCloseTo(DEFAULT_OFFSET, 5)
  })

  it('reads a quiet room around 30 dB with the default offset', () => {
    // rms 0.0018 ≈ -55 dBFS
    expect(rmsToDb(0.0018, DEFAULT_OFFSET)).toBeGreaterThan(39)
    expect(rmsToDb(0.0018, DEFAULT_OFFSET)).toBeLessThan(41)
  })

  it('clamps into the display range and never returns -Infinity', () => {
    expect(rmsToDb(0, DEFAULT_OFFSET)).toBe(0)
    expect(rmsToDb(1, 200)).toBe(120)
    expect(Number.isFinite(rmsToDb(0, 95))).toBe(true)
  })

  it('clamps helper', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-5, 0, 3)).toBe(0)
  })
})

describe('smoothing', () => {
  it('frames a step with the reference 0.72/0.28 factor', () => {
    expect(frameAverage(0, 100)).toBeCloseTo(28, 5)
    expect(frameAverage(Number.NaN, 42)).toBe(42)
  })

  it('reaches ~63% after one time constant', () => {
    expect(timeWeight(0, 100, 1000, 1000)).toBeCloseTo(63.21, 1)
    expect(timeWeight(0, 100, 1000, 1000)).toBeLessThan(100)
  })

  it('keeps reverse mode slower than forward mode', () => {
    expect(tauForMode('forward', false)).toBeLessThan(tauForMode('reverse', false))
    expect(tauForMode('reverse', true)).toBeGreaterThan(tauForMode('reverse', false))
  })
})

describe('active level', () => {
  it('picks the highest crossed threshold in forward mode', () => {
    expect(pickActiveLevel('forward', forward, 60)).toBeNull()
    expect(pickActiveLevel('forward', forward, 66)?.threshold).toBe(65)
    expect(pickActiveLevel('forward', forward, 76)?.threshold).toBe(75)
    expect(pickActiveLevel('forward', forward, 90)?.threshold).toBe(85)
  })

  it('picks the lowest crossed threshold in reverse mode', () => {
    expect(pickActiveLevel('reverse', reverse, 65)).toBeNull()
    expect(pickActiveLevel('reverse', reverse, 55)?.threshold).toBe(60)
    expect(pickActiveLevel('reverse', reverse, 45)?.threshold).toBe(50)
    expect(pickActiveLevel('reverse', reverse, 20)?.threshold).toBe(40)
  })

  it('ignores disabled levels', () => {
    const levels = [level(60), level(80, false)]
    expect(pickActiveLevel('forward', levels, 85)?.threshold).toBe(60)
  })

  it('keeps the most severe level when several match', () => {
    const levels: Level[] = [level(40), level(60), level(70)]
    expect(pickActiveLevel('forward', levels, 75)?.threshold).toBe(70)
  })
})

describe('level ordering', () => {
  it('sorts least severe first', () => {
    expect(sortLevels('forward', [level(80), level(60)]).map((l) => l.threshold)).toEqual([60, 80])
    expect(sortLevels('reverse', [level(60), level(40)]).map((l) => l.threshold)).toEqual([60, 40])
  })

  it('reports crossing thresholds as a conflict', () => {
    expect(validateLevels('forward', [level(70), level(60)])).not.toBeNull()
    expect(validateLevels('forward', [level(60), level(70)])).toBeNull()
    expect(validateLevels('reverse', [level(60), level(40)])).toBeNull()
    expect(validateLevels('reverse', [level(40), level(60)])).not.toBeNull()
  })

  it('validates the shipped presets', () => {
    ;(['forward', 'reverse'] as Mode[]).forEach((mode) => {
      expect(validateLevels(mode, defaultLevels(mode))).toBeNull()
    })
  })
})
