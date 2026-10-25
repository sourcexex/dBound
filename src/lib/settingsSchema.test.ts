import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FULLSCREEN_TITLE,
  DEFAULT_MODE_LABELS,
  FULLSCREEN_SUBTITLE_MAX,
  SETTINGS_VERSION,
  defaultSettings,
  migrateSettings,
  sanitizeSettings,
} from './settingsSchema'
import {
  DEFAULT_SUBTITLE_COLOR,
  DEFAULT_TITLE_COLOR,
  DEFAULT_TITLE_FONT,
  SUBTITLE_SIZE_MIN,
  TITLE_SIZE_MAX,
} from './titleFonts'
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
    // Same version but a foreign payload (no modeLabels) must not be trusted either.
    expect(sanitizeSettings(legacy)).toEqual(defaultSettings())
  })

  it('keeps a well-formed payload of the current version', () => {
    const current = {
      mode: 'reverse',
      modeLabels: { forward: '自习课模式', reverse: '早读模式' },
      offset: 90,
      readingSmooth: false,
      showPeak: true,
      deviceId: 'default',
      levels: {
        forward: [{ id: 'f-1', threshold: 70, name: '安静', note: '', color: '#2563EB', enabled: true }],
        reverse: [{ id: 'r-1', threshold: 55, name: '大声', note: '', color: '#D97706', enabled: true }],
      },
    }
    const migrated = migrateSettings(current, SETTINGS_VERSION)
    expect(migrated.mode).toBe('reverse')
    expect(migrated.modeLabels.forward).toBe('自习课模式')
    expect(migrated.levels.forward[0].threshold).toBe(70)
  })

  it('sanitizes a current-version payload instead of failing', () => {
    const sanitized = sanitizeSettings({
      mode: 'sideways',
      modeLabels: { forward: '自习课模式' },
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
    expect(sanitizeSettings({ modeLabels: {}, levels: { forward: many } }).levels.forward).toHaveLength(8)
    expect(sanitizeSettings({ modeLabels: {}, levels: { forward: [] } }).levels.forward).toHaveLength(3)
  })

  it('keeps custom mode labels within limits and falls back when empty', () => {
    expect(defaultSettings().modeLabels).toEqual(DEFAULT_MODE_LABELS)

    const custom = sanitizeSettings({ modeLabels: { forward: '自习课模式', reverse: '早读模式' } })
    expect(custom.modeLabels.forward).toBe('自习课模式')
    expect(custom.modeLabels.reverse).toBe('早读模式')

    const broken = sanitizeSettings({ modeLabels: { forward: '   ', reverse: '1234567890123' } })
    expect(broken.modeLabels.forward).toBe(DEFAULT_MODE_LABELS.forward)
    expect(broken.modeLabels.reverse).toHaveLength(8)
  })

  it('sanitizes the fullscreen title and subtitle', () => {
    const custom = sanitizeSettings({
      modeLabels: { forward: '正向', reverse: '反向' },
      fullscreenTitle: '520班分贝仪',
      fullscreenSubtitle: '让朗读声响起来',
    })
    expect(custom.fullscreenTitle).toBe('520班分贝仪')
    expect(custom.fullscreenSubtitle).toBe('让朗读声响起来')

    const broken = sanitizeSettings({
      modeLabels: { forward: '正向', reverse: '反向' },
      fullscreenTitle: '   ',
      fullscreenSubtitle: 'x'.repeat(80),
    })
    expect(broken.fullscreenTitle).toBe(DEFAULT_FULLSCREEN_TITLE)
    expect(broken.fullscreenSubtitle).toHaveLength(FULLSCREEN_SUBTITLE_MAX)

    const emptySubtitle = sanitizeSettings({
      modeLabels: { forward: '正向', reverse: '反向' },
      fullscreenSubtitle: '',
    })
    expect(emptySubtitle.fullscreenSubtitle).toBe('')
  })

  it('sanitizes the title font, size and colour', () => {
    const custom = sanitizeSettings({
      modeLabels: { forward: '正向', reverse: '反向' },
      fullscreenTitleFont: 'kaiti',
      fullscreenTitleSize: 35,
      fullscreenTitleColor: '#DC2626',
    })
    expect(custom.fullscreenTitleFont).toBe('kaiti')
    expect(custom.fullscreenTitleSize).toBe(35)
    expect(custom.fullscreenTitleColor).toBe('#DC2626')

    const broken = sanitizeSettings({
      modeLabels: { forward: '正向', reverse: '反向' },
      fullscreenTitleFont: 'comic-sans',
      fullscreenTitleSize: 999,
      fullscreenTitleColor: 'red',
    })
    expect(broken.fullscreenTitleFont).toBe(DEFAULT_TITLE_FONT)
    expect(broken.fullscreenTitleSize).toBe(TITLE_SIZE_MAX)
    expect(broken.fullscreenTitleColor).toBe(DEFAULT_TITLE_COLOR)
  })

  it('sanitizes the subtitle size and colour', () => {
    const custom = sanitizeSettings({
      modeLabels: { forward: '正向', reverse: '反向' },
      fullscreenSubtitleSize: 24,
      fullscreenSubtitleColor: '#2563EB',
    })
    expect(custom.fullscreenSubtitleSize).toBe(24)
    expect(custom.fullscreenSubtitleColor).toBe('#2563EB')

    const broken = sanitizeSettings({
      modeLabels: { forward: '正向', reverse: '反向' },
      fullscreenSubtitleSize: -5,
      fullscreenSubtitleColor: '#GGG',
    })
    expect(broken.fullscreenSubtitleSize).toBe(SUBTITLE_SIZE_MIN)
    expect(broken.fullscreenSubtitleColor).toBe(DEFAULT_SUBTITLE_COLOR)
  })
})
