import { MicOff, Play, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Gauge } from '../components/Gauge'
import { ModeSwitch } from '../components/ModeSwitch'
import { StatusBar } from '../components/StatusBar'
import { TitleBar } from '../components/TitleBar'
import { Waveform } from '../components/Waveform'
import type { CaptureErrorCode } from '../lib/types'
import { useLevelStore } from '../stores/level'
import { useSettingsStore } from '../stores/settings'

const ERROR_COPY: Record<CaptureErrorCode, { title: string; hint: string }> = {
  denied: {
    title: '麦克风权限被拒绝',
    hint: '打开 Windows「设置 → 隐私和安全性 → 麦克风」，允许桌面应用访问麦克风后重试。',
  },
  'no-device': {
    title: '没有找到麦克风',
    hint: '请确认麦克风已连接，并在系统「声音设置」中选为输入设备。',
  },
  busy: {
    title: '麦克风被占用',
    hint: '关闭正在使用麦克风的其他程序（会议、录音软件）后再试一次。',
  },
  'not-supported': {
    title: '当前环境不支持麦克风',
    hint: '请通过 dBound 桌面程序运行，而不是在普通浏览器标签页中打开。',
  },
  unknown: {
    title: '启动麦克风失败',
    hint: '可以尝试重新插拔麦克风，或检查 Windows 声音设置中的输入设备。',
  },
}

export function MainPage({
  onToggle,
  onStart,
  onOpenSettings,
  onOpenMini,
  onOpenLogs,
  unseenLogs,
}: {
  onToggle: () => void
  onStart: () => void
  onOpenSettings: () => void
  onOpenMini: () => void
  onOpenLogs: () => void
  unseenLogs: boolean
}) {
  const mode = useSettingsStore((state) => state.mode)
  const setMode = useSettingsStore((state) => state.setMode)
  const levels = useSettingsStore((state) => state.levels[state.mode])
  const showPeak = useSettingsStore((state) => state.showPeak)

  const db = useLevelStore((state) => state.db)
  const peak = useLevelStore((state) => state.peak)
  const status = useLevelStore((state) => state.status)
  const error = useLevelStore((state) => state.error)
  const deviceLabel = useLevelStore((state) => state.deviceLabel)
  const constraintFallback = useLevelStore((state) => state.constraintFallback)
  const history = useLevelStore((state) => state.history)
  const activeLevel = useLevelStore((state) => state.activeLevel)

  const accent = activeLevel?.color ?? '#17171A'

  const errorCopy = error ? ERROR_COPY[error.code] : null

  // If the first microphone request takes a while, the OS may be showing a
  // permission prompt outside the app – tell the user what to click.
  const [startHint, setStartHint] = useState(false)
  useEffect(() => {
    if (status !== 'starting' && status !== 'suspended') {
      setStartHint(false)
      return
    }
    const timer = window.setTimeout(() => setStartHint(true), 3500)
    return () => window.clearTimeout(timer)
  }, [status])

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[15px] border border-black/[0.07] bg-paper">
      <TitleBar
        onOpenSettings={onOpenSettings}
        onOpenMini={onOpenMini}
        onOpenLogs={onOpenLogs}
        unseenLogs={unseenLogs}
      />

      <div className="mt-0.5 px-6">
        <ModeSwitch mode={mode} onChange={setMode} />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col justify-center px-6">
        <Gauge
          db={db}
          peak={peak}
          showPeak={showPeak}
          activeLevel={activeLevel}
          mode={mode}
          status={status}
        />

        <div className="mt-9">
          <div className="mb-2 flex items-baseline justify-between text-[10.5px] tracking-[0.02em] text-ink-faint">
            <span>最近 60 秒</span>
            <span className="num">20 – 100 dB</span>
          </div>
          <Waveform history={history} levels={levels} accent={accent} />
        </div>

        {startHint && status === 'starting' ? (
          <p className="mt-3 rounded-lg bg-[#FFFBEB] px-3 py-1.5 text-center text-[10.5px] leading-relaxed text-[#B45309]">
            若系统弹出麦克风权限请求，请点「允许」
          </p>
        ) : null}

        {status === 'suspended' ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-paper/78 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={onStart}
                className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play size={14} strokeWidth={2.4} />
                开始测量
              </button>
              <p className="max-w-[240px] text-center text-[11.5px] leading-relaxed text-ink-soft">
                系统要求先有一次点击，才允许启动音频
              </p>
            </div>
          </div>
        ) : null}

        {status === 'error' && errorCopy ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-paper/92 backdrop-blur-[3px]">
            <div className="mx-2 flex max-w-[300px] flex-col items-center gap-2.5 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
                <MicOff size={19} strokeWidth={2} />
              </span>
              <h2 className="text-[14px] font-semibold text-ink">{errorCopy.title}</h2>
              <p className="text-[11.5px] leading-relaxed text-ink-soft">{errorCopy.hint}</p>
              <button
                type="button"
                onClick={onStart}
                className="mt-1 flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-ink/20"
              >
                <RotateCw size={12.5} strokeWidth={2.2} />
                重试
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <StatusBar
        status={status}
        deviceLabel={deviceLabel}
        constraintFallback={constraintFallback}
        onToggle={onToggle}
      />
    </div>
  )
}
