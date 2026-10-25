import { describe, expect, it } from 'vitest'
import { fluentEmojiImage } from './fluentEmoji'

describe('fluent emoji assets', () => {
  it('maps common emoji to bundled files', () => {
    expect(fluentEmojiImage('😀')).toBeTruthy()
    expect(fluentEmojiImage('😤')).toBeTruthy()
    expect(fluentEmojiImage('☀️')).toBeTruthy()
    expect(fluentEmojiImage('🎉')).toBeTruthy()
  })

  it('falls back for unsupported sequences', () => {
    expect(fluentEmojiImage('a')).toBeUndefined()
  })
})
