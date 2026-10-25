import { EmojiText } from './EmojiText'
import { RollingNumber } from './RollingNumber'
import { useSettingsStore } from '../stores/settings'
import { accentFallback, mutedFallback } from '../lib/theme'
import { fontStackFor } from '../lib/titleFonts'
import type { CaptureStatus, Level } from '../lib/types'

const STATUS_COPY: Record<CaptureStatus, string> = {
  idle: '点击开始测量',
  starting: '启动中…',
  running: '测量中',
  suspended: '等待开始',
  error: '无法访问麦克风',
}

export function Gauge({
  db,
  peak,
  showPeak,
  activeLevel,
  mode,
  status,
  onStart,
}: {
  db: number | null
  peak: number | null
  showPeak: boolean
  activeLevel: Level | null
  mode: 'forward' | 'reverse'
  status: CaptureStatus
  onStart?: () => void
}) {
  const darkMode = useSettingsStore((state) => state.darkMode)
  const idleNumberColor = useSettingsStore((state) => state.idleNumberColor)
  const idleText = useSettingsStore((state) => state.idleText)
  const statusColor = useSettingsStore((state) => state.statusColor)
  const statusFont = useSettingsStore((state) => state.statusFont)
  const statusSize = useSettingsStore((state) => state.statusSize)
  const levelNameSize = useSettingsStore((state) => state.levelNameSize)
  const levelNoteSize = useSettingsStore((state) => state.levelNoteSize)
  const accent = activeLevel?.color ?? (idleNumberColor || accentFallback(darkMode))
  const readoutAnimation = useSettingsStore((state) => state.readoutAnimation)
  const rollingMs = useSettingsStore((state) => state.rollingMs)
  const readoutIntervalMs = useSettingsStore((state) => state.readoutIntervalMs)
  const silentLabel = idleText[mode] || (mode === 'forward' ? '安静' : '音量正常')
  const statusTextColor = statusColor || undefined
  const chipLabel = activeLevel?.name ?? silentLabel
  const chipNote = activeLevel?.note ?? null
  const live = status === 'running' || status === 'suspended' || status === 'starting'
  const dimmed = status !== 'running' && status !== 'starting'

  return (
    <section className="relative flex flex-col items-center">
      {activeLevel ? (
        <span
          key={activeLevel.id}
          aria-hidden
          className="dbound-ripple pointer-events-none absolute top-[44%] left-1/2 h-[168px] w-[168px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ borderColor: accent }}
        />
      ) : null}

      <div
        className={`relative flex items-center justify-center transition-opacity duration-300 ${
          dimmed ? 'opacity-45' : 'opacity-100'
        }`}
      >
        {db === null ? (
          <span className="num text-[54px] leading-none font-semibold tracking-[0.08em] text-ink-faint">
            ––
          </span>
        ) : (
          <span className="relative inline-flex items-center" style={{ fontSize: '108px' }}>
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 h-[176px] w-[188%] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-500"
              style={{
                background: `radial-gradient(closest-side, ${accent}${activeLevel ? '5C' : '2E'} 0%, transparent 80%)`,
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 h-[292px] w-[272%] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-700"
              style={{
                background: `radial-gradient(closest-side, ${accent}${activeLevel ? '26' : '10'} 0%, transparent 76%)`,
              }}
            />
            <span
              aria-hidden
              className="absolute top-[0.14em] right-full pr-[0.18em] text-[0.176em] font-normal text-ink-faint"
            >
              ≈
            </span>
            <RollingNumber
              value={db}
              animate={readoutAnimation}
              durationMs={rollingMs}
              refreshMs={readoutIntervalMs}
              className="num font-semibold tracking-[-0.03em] transition-colors duration-200"
              style={{ color: accent }}
            />
          </span>
        )}
      </div>

      <div
        className={`mt-[6px] text-[11.5px] font-medium tracking-[0.14em] text-ink-soft transition-opacity duration-300 ${
          dimmed ? 'opacity-45' : 'opacity-100'
        }`}
      >
        dB
      </div>

      <div className="mt-[18px] flex h-8 items-center">
        <div
          key={chipLabel + chipNote}
          className={`dbound-rise flex items-center gap-2 rounded-full border border-black/[0.06] bg-surface/90 px-3.5 py-1.5 transition-opacity duration-300 ${
            dimmed ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <span
            className="h-[7px] w-[7px] rounded-full transition-colors duration-200"
            style={{ backgroundColor: activeLevel ? accent : mutedFallback(darkMode) }}
          />
          <span
            className="font-semibold text-ink"
            style={{
              fontFamily: fontStackFor(statusFont),
              fontSize: `${activeLevel ? levelNameSize : Math.max(10, Math.min(24, statusSize))}px`,
              color: activeLevel ? activeLevel.color : statusTextColor,
            }}
          >
            <EmojiText text={chipLabel} />
          </span>
          {chipNote ? (
            <>
              <span className="text-ink-faint">·</span>
              <span
                className="text-ink-soft"
                style={{
                  fontFamily: fontStackFor(statusFont),
                  fontSize: `${levelNoteSize}px`,
                  color: activeLevel?.color,
                }}
              >
                <EmojiText text={chipNote} />
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-[6px] h-4 text-[11px] tracking-[0.02em] text-ink-faint">
        {showPeak && live && peak !== null ? (
          <>峰值 {peak.toFixed(1)} dB</>
        ) : status === 'idle' || status === 'suspended' ? (
          <button
            type="button"
            onClick={onStart}
            className="cursor-pointer rounded px-1 text-[11px] tracking-[0.02em] text-ink-soft underline decoration-dotted underline-offset-2 transition-colors hover:text-ink"
          >
            {STATUS_COPY[status]}
          </button>
        ) : (
          STATUS_COPY[status]
        )}
      </div>
    </section>
  )
}
