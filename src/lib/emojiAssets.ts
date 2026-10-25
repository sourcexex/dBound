import { rewardFileUrl } from './resourceAssets'

function keyFor(char: string): string {
  return Array.from(char)
    .map((codePoint) => codePoint.codePointAt(0)!.toString(16))
    .join('-')
}

/** Reward art is loaded from <install>/resources/emoji-reward. */
export function emojiImage(char: string): string | undefined {
  return rewardFileUrl(keyFor(char))
}

/** Curated Fluent Emoji 3D set used for the fullscreen reward row. */
export const EMOJI_CHARS = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😆',
  '😊',
  '😇',
  '🙂',
  '😉',
  '😍',
  '🤩',
  '😎',
  '🤗',
  '😂',
  '🥳',
  '🤝',
  '👍',
  '👏',
  '🙌',
  '💪',
  '✌️',
  '👌',
  '🎉',
  '🎊',
  '🎈',
  '🎁',
  '🏆',
  '🥇',
  '👑',
  '🚀',
  '⭐',
  '🌟',
  '✨',
  '🌈',
  '☀️',
  '🌻',
  '🌸',
  '🍀',
  '🐱',
  '🐶',
]

export function randomEmoji(): { char: string; src: string | undefined } {
  const char = EMOJI_CHARS[Math.floor(Math.random() * EMOJI_CHARS.length)]
  return { char, src: emojiImage(char) }
}
