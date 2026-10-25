import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/** Display refresh interval for the reels – smooth but not jittery. */
const REFRESH_MS = 100

function Digit({ digit }: { digit: number }) {
  return (
    <span
      className="relative inline-block overflow-hidden align-bottom"
      style={{ width: '0.56em', height: '1em' }}
    >
      <span
        className="absolute inset-x-0 top-0 flex flex-col will-change-transform"
        style={{
          transform: `translateY(-${digit}em)`,
          transition: 'transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {DIGITS.map((value) => (
          <span
            key={value}
            className="block text-center"
            style={{ height: '1em', lineHeight: '1em' }}
          >
            {value}
          </span>
        ))}
      </span>
    </span>
  )
}

/**
 * Odometer style number: every digit is a vertical reel that slides to its new
 * value, so the readout moves continuously instead of snapping frame by frame.
 */
export function RollingNumber({
  value,
  decimals = 1,
  className = '',
  style,
  placeholder = '––',
}: {
  value: number | null
  decimals?: number
  className?: string
  style?: CSSProperties
  placeholder?: string
}) {
  const valueRef = useRef(value)
  valueRef.current = value

  const [display, setDisplay] = useState<number | null>(value)

  // Throttle the reel updates; the sensor still runs at 30 Hz.
  useEffect(() => {
    let frame = 0
    let last = 0
    const tick = (now: number) => {
      if (now - last >= REFRESH_MS) {
        last = now
        setDisplay(valueRef.current)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const text = display === null || !Number.isFinite(display) ? null : display.toFixed(decimals)

  if (text === null) {
    return (
      <span className={className} style={{ ...style, lineHeight: 1 }}>
        {placeholder}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ ...style, lineHeight: 1 }}
      aria-label={text}
    >
      {text.split('').map((char, index) =>
        char === '.' ? (
          <span
            key={`dot-${index}`}
            className="inline-block text-center"
            style={{ width: '0.24em' }}
          >
            .
          </span>
        ) : (
          <Digit key={`digit-${index}`} digit={Number(char)} />
        ),
      )}
    </span>
  )
}
