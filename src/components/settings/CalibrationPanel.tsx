import { useEffect, useRef, useState } from 'react'
import { Mic, RotateCcw, Volume1 } from 'lucide-react'
import { DEFAULT_OFFSET, calibratedOffset } from '../../lib/dsp'
import { logSystem } from '../../lib/logger'
import { useLevelStore } from '../../stores/level'
import { useSettingsStore } from '../../stores/settings'
import { Row, SectionCard } from '../ui/SectionCard'

const CALIBRATION_MS = 3000
const QUIET_TARGET = 35
const READING_TARGET = 70
const OFFSET_MIN = 65
const OFFSET_MAX = 125

export function CalibrationPanel() {
  const offset = useSettingsStore((state) => state.offset)
  const setOffset = useSettingsStore((state) => state.setOffset)
  const status = useLevelStore((state) => state.status)

  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const samplesRef = useRef<number[]>([])
  const timerRef = useRef(0)

  const measuring = status === 'running' || status === 'suspended'

  useEffect(() => () => window.clearInterval(timerRef.current), [])

  const startCalibration = (target: number) => {
    if (!measuring) {
      setMessage('请先回到主页开始测量，再进行校准。')
      return
    }
    window.clearInterval(timerRef.current)
    samplesRef.current = []
    setMessage(null)
    const startedAt = performance.now()

    timerRef.current = window.setInterval(() => {
      const reading = useLevelStore.getState().db
      if (reading !== null) samplesRef.current.push(reading)

      const done = Math.min(1, (performance.now() - startedAt) / CALIBRATION_MS)
      setProgress(done)

      if (done >= 1) {
        window.clearInterval(timerRef.current)
        setProgress(null)
        const samples = samplesRef.current
        if (samples.length === 0) {
          setMessage('没有读到有效数据，请检查麦克风后重试。')
          return
        }
        const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
        const next = calibratedOffset(
          useSettingsStore.getState().offset,
          average,
          target,
          OFFSET_MIN,
          OFFSET_MAX,
        )
        setOffset(next)
        logSystem(
          `校准（${target === QUIET_TARGET ? '安静环境' : '朗读'}）：实测 ${average.toFixed(1)} dB，对齐到 ${target} dB，偏移 ${next.toFixed(1)}`,
        )
        setMessage(
          `校准完成：实测平均 ${average.toFixed(1)} dB，已对齐到 ${target} dB（偏移 ${next.toFixed(1)}）`,
        )
      }
    }, 100)
  }

  return (
    <div className="space-y-3">
      <SectionCard title="校准偏移" hint="所有读数 = 麦克风 dBFS + 偏移量，不同麦克风差 10 dB 很正常">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="num text-[22px] font-semibold text-ink">{offset.toFixed(1)}</span>
          <span className="text-[10.5px] text-ink-faint">默认 {DEFAULT_OFFSET}</span>
        </div>
        <input
          type="range"
          className="dbound-range"
          min={OFFSET_MIN}
          max={OFFSET_MAX}
          step={0.5}
          value={offset}
          onChange={(event) => setOffset(Number(event.target.value))}
        />
        <div className="mt-1 flex justify-between text-[9.5px] tabular-nums text-ink-faint">
          <span>{OFFSET_MIN}</span>
          <span>{OFFSET_MAX}</span>
        </div>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setOffset(DEFAULT_OFFSET)
              setMessage('已恢复默认偏移。')
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            <RotateCcw size={11.5} strokeWidth={2} />
            恢复默认
          </button>
        </div>
      </SectionCard>

      <SectionCard title="一键校准" hint="保持环境安静 3 秒，或正常朗读一句，自动对齐读数">
        <div className="space-y-2">
          <button
            type="button"
            disabled={progress !== null}
            onClick={() => startCalibration(QUIET_TARGET)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors enabled:hover:border-ink/25 disabled:opacity-60"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-paper-2 text-ink-soft">
              <Volume1 size={15} strokeWidth={2} />
            </span>
            <span className="flex-1">
              <span className="block text-[12px] font-medium text-ink">安静环境校准</span>
              <span className="block text-[10.5px] text-ink-faint">采样 3 秒底噪，对齐到 {QUIET_TARGET} dB</span>
            </span>
          </button>

          <button
            type="button"
            disabled={progress !== null}
            onClick={() => startCalibration(READING_TARGET)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors enabled:hover:border-ink/25 disabled:opacity-60"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-paper-2 text-ink-soft">
              <Mic size={15} strokeWidth={2} />
            </span>
            <span className="flex-1">
              <span className="block text-[12px] font-medium text-ink">朗读校准</span>
              <span className="block text-[10.5px] text-ink-faint">
                正常朗读一句，对齐到 {READING_TARGET} dB（反向模式推荐）
              </span>
            </span>
          </button>
        </div>

        {progress !== null ? (
          <div className="mt-3">
            <div className="h-1 w-full overflow-hidden rounded-full bg-paper-2">
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-100"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10.5px] text-ink-soft">正在采样，请保持当前声音状态…</p>
          </div>
        ) : null}

        {message ? <p className="mt-2 text-[10.5px] leading-relaxed text-ink-soft">{message}</p> : null}
      </SectionCard>

      <SectionCard title="说明">
        <Row label="读数含义" hint="dB 值由麦克风 RMS 换算而来，只用于比较相对大小，不是声级计的计量结果。" />
        <Row label="追求准确" hint="需要真实分贝值请使用符合 IEC 61672 的 Class 1/2 声级计。" />
      </SectionCard>
    </div>
  )
}
