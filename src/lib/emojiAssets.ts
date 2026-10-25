/** Bundled Microsoft Fluent Emoji (3D) so Win10 and Win11 look identical. */
const modules = import.meta.glob<string>('../assets/emoji/*.png', {
  eager: true,
  import: 'default',
})

const byKey: Record<string, string> = {}
for (const [path, url] of Object.entries(modules)) {
  const name = path.split('/').pop()?.replace(/\.png$/i, '') ?? ''
  if (name) byKey[name] = url
}

function keyFor(char: string): string {
  return Array.from(char)
    .map((codePoint) => codePoint.codePointAt(0)!.toString(16))
    .join('-')
}

export function emojiImage(char: string): string | undefined {
  return byKey[keyFor(char)]
}

export const EMOJI_CHARS = [
  '😀',
  '😄',
  '😁',
  '😊',
  '🥳',
  '🤩',
  '😍',
  '😎',
  '🤗',
  '😆',
  '🎉',
  '🌟',
  '🐱',
  '🐶',
  '🌈',
  '☀️',
  '✨',
  '🎈',
  '🏆',
  '🚀',
]

export function randomEmoji(): { char: string; src: string | undefined } {
  const char = EMOJI_CHARS[Math.floor(Math.random() * EMOJI_CHARS.length)]
  return { char, src: emojiImage(char) }
}
