import emojiRegex from 'emoji-regex'
import { emojiFileUrl } from './resourceAssets'

const SKIN_TONES = new Set([0x1f3fb, 0x1f3fc, 0x1f3fd, 0x1f3fe, 0x1f3ff])
const hex = (value: number) => value.toString(16)

/** Candidate resource file names for an emoji sequence (loose files on disk). */
export function emojiKeys(char: string): string[] {
  const codepoints = Array.from(char).map((codePoint) => codePoint.codePointAt(0)!)
  const withoutFe0f = codepoints.filter((value) => value !== 0xfe0f)
  const withoutSkin = codepoints.filter((value) => !SKIN_TONES.has(value))
  const keys = new Set<string>()
  keys.add(codepoints.map(hex).join('-'))
  keys.add(withoutFe0f.map(hex).join('-'))
  keys.add(withoutSkin.map(hex).join('-'))
  keys.add(withoutSkin.filter((value) => value !== 0xfe0f).map(hex).join('-'))
  // ZWJ sequences that Fluent does not ship fall back to their first character.
  keys.add(hex(codepoints[0]))
  return [...keys].filter(Boolean)
}

/** Resolve an emoji to a Fluent image URL from <install>/resources/emoji. */
export function fluentEmojiImage(char: string): string | undefined {
  for (const key of emojiKeys(char)) {
    const url = emojiFileUrl(key)
    if (url) return url
  }
  return undefined
}

export const EMOJI_PATTERN = emojiRegex()
