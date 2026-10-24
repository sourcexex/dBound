import { describe, expect, it } from 'vitest'
import {
  SETTINGS_VERSION,
  defaultSettings,
  migrateSettings,
  sanitizeSettings,
} from './settingsSchema'
import { DEFAULT_OFFSET } from './dsp'

describe('settings schema', () => {
  it('exposes the shipped presets as defaults', () => {
    const settings = defaultSettings()
    expect(settings.mode).toBe('forward')
    expect(settings.offset).toBe(DEFAULT_OFFSET)
    expect(settings.levels.forward).toHaveLength(3)
    expect(settings.levels.reverse.map((level) => level.threshold)).toEqual([60, 50, 40])
  })

  it('drops persisted state from an unknown/older layout', () => {
    const legacy = {
      mode: 'reverse',
      levels: {
        forward: [{ id: 'x', threshold: 35, name: '级别 4', note: '正常', color: '#16A34A' }],
        reverse: [],
      },
    }
    expect(migrateSettings(legacy, 0)).toEqual(defaultSettings())
    expect(migrateSettings(legacy, SETTINGS_VERSION - 1)).toEqual(defaultSettings())
  })

  it('sanitizes a current-version payload instead of failing', () => {
    const sanitized = sanitizeSettings({
      mode: 'sideways',
      offset: 500,
      readingSmooth: false,
      showPeak: 'nope',
      deviceId: '',
      levels: {
        forward: [
          { id: 'a', threshold: 63.7, name: '1234567890', note: 'x'.repeat(40), color: 'red' },
          { threshold: 'bad' },
        ],
      },
    })

    expect(sanitized.mode).toBe('forward')
    expect(sanitized.offset).toBe(125)
    expect(sanitized.readingSmooth).toBe(false)
    expect(sanitized.showPeak).toBe(true)
    expect(sanitized.deviceId).toBe('default')

    const [level] = sanitized.levels.forward
    expect(level.threshold).toBe(63.5)
    expect(level.name).toHaveLength(8)
    expect(level.note).toHaveLength(30)
    expect(level.color).toMatch(/^#[0-9a-f]{6}$/i)
    // reverse had no usable data → defaults
    expect(sanitized.levels.reverse).toHaveLength(3)
  })

  it('caps the number of levels and guarantees at least one', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      id: `l-${index}`,
      threshold: index * 5,
      name: `L${index}`,
      note: '',
      color: '#2563EB',
      enabled: true,
    }))
    expect(sanitizeSettings({ levels: { forward: many } }).levels.forward).toHaveLength(8)
    expect(sanitizeSettings({ levels: { forward: [] } }).levels.forward).toHaveLength(3)
  })
})
