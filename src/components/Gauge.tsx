import { RollingNumber } from './RollingNumber'
import { useSettingsStore } from '../stores/settings'
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
}: {
  db: number | null
  peak: number | null
  showPeak: boolean
  activeLevel: Level | null
  mode: 'forward' | 'reverse'
  status: CaptureStatus
}) {
  const accent = activeLevel?.color ?? '#17171A'
  const readoutAnimation = useSettingsStore((state) => state.readoutAnimation)
  const rollingMs = useSettingsStore((state) => state.rollingMs)
  const readoutIntervalMs = useSettingsStore((state) => state.readoutIntervalMs)
  const silentLabel = mode === 'forward' ? '安静' : '音量正常'
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
          <span className="num text-[54px] leading-none font-semibold tracking-[0.08em] text-[#CFCEC7]">
            ––
          </span>
        ) : (
          <span className="relative inline-flex items-center" style={{ fontSize: '108px' }}>
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 h-[104px] w-[142%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[52px] transition-all duration-500"
              style={{ backgroundColor: accent, opacity: activeLevel ? 0.32 : 0.15 }}
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
          className={`dbound-rise flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/75 px-3.5 py-1.5 backdrop-blur-sm transition-opacity duration-300 ${
            dimmed ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <span
            className="h-[7px] w-[7px] rounded-full transition-colors duration-200"
            style={{ backgroundColor: activeLevel ? accent : '#C7C6BE' }}
          />
          <span className="text-[12.5px] font-semibold text-ink">{chipLabel}</span>
          {chipNote ? (
            <>
              <span className="text-ink-faint">·</span>
              <span className="text-[12.5px] text-ink-soft">{chipNote}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-[6px] h-4 text-[11px] tracking-[0.02em] text-ink-faint">
        {showPeak && live && peak !== null ? <>峰值 {peak.toFixed(1)} dB</> : STATUS_COPY[status]}
      </div>
    </section>
  )
}
