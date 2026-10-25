import { Mic, Pause, Play, TriangleAlert } from 'lucide-react'
import type { CaptureStatus } from '../lib/types'

const STATUS_TEXT: Record<CaptureStatus, string> = {
  idle: '已暂停 · 麦克风已释放',
  starting: '正在启动…',
  running: '正在测量',
  suspended: '等待点击开始',
  error: '无法访问麦克风',
}

export function StatusBar({
  status,
  deviceLabel,
  constraintFallback,
  onToggle,
}: {
  status: CaptureStatus
  deviceLabel: string
  constraintFallback: boolean
  onToggle: () => void
}) {
  const active = status === 'running' || status === 'suspended' || status === 'starting'

  return (
    <footer className="flex h-[68px] shrink-0 items-center gap-3 border-t border-line/80 px-5">
      <button
        type="button"
        onClick={onToggle}
        aria-label={active ? '暂停测量' : '开始测量'}
        title={active ? '暂停测量' : '开始测量'}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 hover:border-ink/25 hover:shadow-[0_2px_6px_rgba(0,0,0,0.07)] active:scale-95"
      >
        {active ? <Pause size={15} strokeWidth={2.2} /> : <Play size={15} strokeWidth={2.2} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
          <Mic size={12.5} strokeWidth={2} className="shrink-0 text-ink-soft" />
          <span className="truncate">{deviceLabel || '默认麦克风'}</span>
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-ink-faint">{STATUS_TEXT[status]}</div>
      </div>

      {constraintFallback ? (
        <span
          title="当前麦克风不接受「关闭自动增益」等约束，读数波动可能更大"
          className="grid h-7 w-7 place-items-center rounded-md bg-[#FEF3C7] text-[#B45309]"
        >
          <TriangleAlert size={13} strokeWidth={2} />
        </span>
      ) : null}
    </footer>
  )
}
