import type { Level, Mode } from '../../lib/types'

const MIN = 0
const MAX = 120

function percent(value: number): number {
  return (Math.min(MAX, Math.max(MIN, value)) / (MAX - MIN)) * 100
}

/** Horizontal 0–120 dB strip showing level zones and the live reading. */
export function ThresholdScale({
  mode,
  levels,
  db,
  accent,
}: {
  mode: Mode
  levels: Level[]
  db: number | null
  accent: string
}) {
  const ordered = [...levels]
    .filter((level) => level.enabled)
    .sort((a, b) => (mode === 'forward' ? a.threshold - b.threshold : b.threshold - a.threshold))

  const segments = ordered.map((level, index) => {
    const next = ordered[index + 1]
    const start = mode === 'forward' ? level.threshold : (next?.threshold ?? MIN)
    const end = mode === 'forward' ? (next?.threshold ?? MAX) : level.threshold
    return { level, left: percent(start), width: Math.max(0, percent(end) - percent(start)) }
  })

  return (
    <div className="relative">
      <div className="relative h-[34px] w-full overflow-hidden rounded-lg bg-paper-2">
        {segments.map(({ level, left, width }) => (
          <span
            key={level.id}
            className="absolute inset-y-0"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              backgroundColor: level.color,
              opacity: 0.16,
            }}
          />
        ))}
        {ordered.map((level) => (
          <span
            key={`tick-${level.id}`}
            className="absolute inset-y-0 w-px"
            style={{ left: `${percent(level.threshold)}%`, backgroundColor: level.color, opacity: 0.55 }}
          />
        ))}
        {db !== null ? (
          <span
            className="absolute inset-y-[3px] w-[2px] rounded-full transition-[left] duration-100"
            style={{ left: `${percent(db)}%`, backgroundColor: accent }}
          >
            <span
              className="absolute -top-[3px] left-1/2 h-[7px] w-[7px] -translate-x-1/2 rounded-full ring-2 ring-white"
              style={{ backgroundColor: accent }}
            />
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex justify-between text-[9.5px] tabular-nums text-ink-faint">
        <span>0 dB</span>
        <span>60</span>
        <span>120 dB</span>
      </div>
    </div>
  )
}
