import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

function Digit({ digit, durationMs }: { digit: number; durationMs: number }) {
  return (
    <span
      className="relative inline-block overflow-hidden align-bottom"
      style={{ width: '0.56em', height: '1em' }}
    >
      <span
        className="absolute inset-x-0 top-0 flex flex-col will-change-transform"
        style={{
          transform: `translateY(-${digit}em)`,
          transition: `transform ${durationMs}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
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
 * value. The refresh interval controls how often the displayed value moves, so
 * the readout can trail behind the raw sensor instead of twitching constantly.
 */
export function RollingNumber({
  value,
  decimals = 1,
  animate = true,
  durationMs = 600,
  refreshMs = 400,
  className = '',
  style,
  placeholder = '––',
}: {
  value: number | null
  decimals?: number
  animate?: boolean
  durationMs?: number
  refreshMs?: number
  className?: string
  style?: CSSProperties
  placeholder?: string
}) {
  const valueRef = useRef(value)
  valueRef.current = value
  const refreshRef = useRef(refreshMs)
  refreshRef.current = refreshMs

  const [display, setDisplay] = useState<number | null>(value)

  // Throttled display refresh – the sensor still runs at 30 Hz underneath.
  // The loop is parked while the window is hidden so a tray/minimised window
  // costs no GPU/CPU for transitions.
  useEffect(() => {
    let frame = 0
    let last = 0
    let running = false
    const tick = (now: number) => {
      if (!running) return
      if (now - last >= refreshRef.current) {
        last = now
        setDisplay(valueRef.current)
      }
      frame = requestAnimationFrame(tick)
    }
    const start = () => {
      if (running) return
      running = true
      last = 0
      frame = requestAnimationFrame(tick)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(frame)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stop()
      } else {
        setDisplay(valueRef.current)
        start()
      }
    }
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const text = display === null || !Number.isFinite(display) ? null : display.toFixed(decimals)

  if (text === null) {
    return (
      <span className={className} style={{ ...style, lineHeight: 1 }}>
        {placeholder}
      </span>
    )
  }

  if (!animate) {
    return (
      <span className={className} style={{ ...style, lineHeight: 1 }} aria-label={text}>
        {text}
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
          <Digit key={`digit-${index}`} digit={Number(char)} durationMs={durationMs} />
        ),
      )}
    </span>
  )
}
