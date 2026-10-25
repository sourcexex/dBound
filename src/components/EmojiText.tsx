import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { EMOJI_PATTERN, fluentEmojiImage } from '../lib/fluentEmoji'

/**
 * Renders text with emoji replaced by bundled Fluent Emoji images, so Win10 and
 * Win11 show the same artwork. Input elements still use the system emoji font.
 */
export function EmojiText({
  text,
  className,
  style,
}: {
  text: string
  className?: string
  style?: CSSProperties
}) {
  if (!text) return null

  const nodes: ReactNode[] = []
  let last = 0
  let order = 0
  const regex = new RegExp(EMOJI_PATTERN.source, 'gu')

  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0
    if (start > last) {
      nodes.push(<Fragment key={`t${order++}`}>{text.slice(last, start)}</Fragment>)
    }
    const char = match[0]
    const src = fluentEmojiImage(char)
    if (src) {
      nodes.push(
        <img
          key={`e${order++}`}
          src={src}
          alt={char}
          draggable={false}
          className="inline-block align-[-0.12em]"
          style={{ width: '1em', height: '1em' }}
        />,
      )
    } else {
      nodes.push(<Fragment key={`c${order++}`}>{char}</Fragment>)
    }
    last = start + char.length
  }

  if (last < text.length) {
    nodes.push(<Fragment key={`t${order++}`}>{text.slice(last)}</Fragment>)
  }

  return (
    <span className={className} style={style}>
      {nodes}
    </span>
  )
}
