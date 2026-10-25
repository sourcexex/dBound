import { describe, expect, it } from 'vitest'
import { EMOJI_CHARS } from './emojiAssets'
import { emojiKeys, fluentEmojiImage } from './fluentEmoji'

describe('emoji resources', () => {
  it('derives codepoint file names for emoji sequences', () => {
    expect(emojiKeys('😀')).toContain('1f600')
    expect(emojiKeys('☀️')).toContain('2600-fe0f')
    expect(emojiKeys('😤')).toContain('1f624')
  })

  it('keeps the curated 40 reward emoji', () => {
    expect(EMOJI_CHARS).toHaveLength(40)
  })

  it('returns no URL before the resource dir is initialised', () => {
    expect(fluentEmojiImage('😀')).toBeUndefined()
  })
})
