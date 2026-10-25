import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Download, RefreshCw, Trash2 } from 'lucide-react'
import { localDay, type LogEntry, type LogKind } from '../lib/logger'
import { isTauri } from '../lib/tauri'

const FILTERS: Array<{ id: 'all' | LogKind; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'alert', label: '触发' },
  { id: 'sample', label: '采样' },
  { id: 'device', label: '设备' },
  { id: 'system', label: '系统' },
]

const KIND_COLOR: Record<LogKind, string> = {
  alert: '#DC2626',
  sample: '#C2C1BA',
  device: '#2563EB',
  system: '#6B6B72',
}

const KIND_LABEL: Record<LogKind, string> = {
  alert: '触发',
  sample: '采样',
  device: '设备',
  system: '系统',
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false })
}

function DaySparkline({ values }: { values: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    if (values.length < 2) return

    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = Math.max(4, max - min)
    const step = width / (values.length - 1)
    const toY = (value: number) => height - 4 - ((value - min) / span) * (height - 8)

    ctx.beginPath()
    values.forEach((value, index) => {
      const x = index * step
      const y = toY(value)
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = 'rgba(23,23,26,0.45)'
    ctx.lineWidth = 1.2
    ctx.lineJoin = 'round'
    ctx.stroke()
  }, [values])

  return <canvas ref={canvasRef} className="block h-[44px] w-full" />
}

export function LogsPage({ onBack }: { onBack: () => void }) {
  const [days, setDays] = useState<string[]>([])
  const [day, setDay] = useState<string>(() => localDay())
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<'all' | LogKind>('alert')
  const [query, setQuery] = useState('')
  const [logDir, setLogDir] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async (targetDay: string) => {
    if (!isTauri()) return
    const { invoke } = await import('@tauri-apps/api/core')
    try {
      const [listed, loaded, dir] = await Promise.all([
        invoke<string[]>('log_days'),
        invoke<LogEntry[]>('log_read', { day: targetDay, limit: 4000 }),
        invoke<string>('log_dir'),
      ])
      setDays(listed)
      setEntries(loaded)
      setLogDir(dir)
    } catch {
      // ignore – the page still shows whatever is already loaded
    }
  }, [])

  useEffect(() => {
    void load(day)
    const timer = window.setInterval(() => {
      void load(day)
    }, 2500)
    return () => window.clearInterval(timer)
  }, [day, load])

  const samples = useMemo(
    () => entries.filter((entry) => entry.kind === 'sample' && entry.db !== null).map((entry) => entry.db as number),
    [entries],
  )

  const stats = useMemo(() => {
    if (samples.length === 0) return null
    const sum = samples.reduce((acc, value) => acc + value, 0)
    return {
      average: sum / samples.length,
      min: Math.min(...samples),
      max: Math.max(...samples),
    }
  }, [samples])

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return entries
      .filter((entry) => filter === 'all' || entry.kind === filter)
      .filter((entry) => {
        if (!keyword) return true
        return (
          entry.text.toLowerCase().includes(keyword) ||
          (entry.level ?? '').toLowerCase().includes(keyword)
        )
      })
      .slice()
      .reverse()
  }, [entries, filter, query])

  const exportCsv = async () => {
    if (!isTauri() || busy) return
    setBusy(true)
    setMessage(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const all = await invoke<LogEntry[]>('log_read', { day, limit: 0 })
      if (all.length === 0) {
        setMessage('这一天还没有日志。')
        return
      }
      const header = '时间,类型,级别,dB,文本'
      const rows = all.map((entry) => {
        const cells = [
          `"${new Date(entry.ts).toLocaleString('zh-CN', { hour12: false })}"`,
          KIND_LABEL[entry.kind],
          entry.level ?? '',
          entry.db === null ? '' : entry.db.toFixed(1),
          `"${entry.text.replace(/"/g, '""')}"`,
        ]
        return cells.join(',')
      })
      const content = `\uFEFF${header}\n${rows.join('\n')}\n`

      const { save } = await import('@tauri-apps/plugin-dialog')
      const path = await save({
        defaultPath: `dbound-${day}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })
      if (!path) return
      await invoke('log_export', { path, content })
      setMessage(`已导出到 ${path}`)
    } catch {
      setMessage('导出失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  const clearLogs = async () => {
    if (!isTauri() || busy) return
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    setBusy(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('log_clear')
      setEntries([])
      setDays([])
      setMessage('日志已清空。')
    } catch {
      setMessage('清空失败，请重试。')
    } finally {
      setBusy(false)
      setConfirmClear(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-1 pl-2 pr-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回"
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] text-ink-soft transition-colors hover:bg-black/[0.05] hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={2.2} />
          返回
        </button>
        <h1 className="ml-1 flex-1 text-[13px] font-semibold text-ink">日志</h1>
        <button
          type="button"
          onClick={() => void exportCsv()}
          disabled={busy}
          aria-label="导出 CSV"
          title="导出 CSV"
          className="grid h-7 w-7 place-items-center rounded-md text-ink-soft transition-colors hover:bg-black/[0.06] hover:text-ink disabled:opacity-40"
        >
          <Download size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => void clearLogs()}
          aria-label="清空日志"
          title="清空日志"
          className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${
            confirmClear
              ? 'bg-[#FEE2E2] text-[#B91C1C]'
              : 'text-ink-soft hover:bg-black/[0.06] hover:text-ink'
          }`}
        >
          <Trash2 size={13.5} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => void load(day)}
          aria-label="刷新"
          title="刷新"
          className="grid h-7 w-7 place-items-center rounded-md text-ink-soft transition-colors hover:bg-black/[0.06] hover:text-ink"
        >
          <RefreshCw size={13.5} strokeWidth={2} />
        </button>
      </header>

      <div className="shrink-0 px-4">
        <div className="flex items-center gap-2">
          <select
            value={day}
            onChange={(event) => setDay(event.target.value)}
            className="num rounded-lg border border-line bg-white px-2 py-1 text-[11.5px] text-ink outline-none"
          >
            {[day, ...days.filter((item) => item !== day)].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索提示文字或级别…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-1 text-[11.5px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink/30"
          />
        </div>

        <div className="mt-2 flex items-center gap-1">
          {FILTERS.map((item) => {
            const active = item.id === filter
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-full px-2.5 py-[4px] text-[11px] transition-colors ${
                  active
                    ? 'bg-ink font-semibold text-white'
                    : 'bg-paper-2 font-medium text-ink-soft hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {stats ? (
          <div className="mt-2.5 rounded-xl border border-black/[0.06] bg-white/80 p-2.5">
            <div className="flex items-baseline justify-between text-[10.5px] text-ink-soft">
              <span>当日采样 {samples.length} 条</span>
              <span className="num">
                均 {stats.average.toFixed(1)} · 低 {stats.min.toFixed(1)} · 高 {stats.max.toFixed(1)} dB
              </span>
            </div>
            <div className="mt-1.5">
              <DaySparkline values={samples} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
        {visible.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <p className="text-[11.5px] leading-relaxed text-ink-faint">
              这一天还没有{filter === 'all' ? '日志' : FILTERS.find((f) => f.id === filter)?.label}
              <br />
              测量时每秒会记录一条采样，触发级别时会记录事件
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.04]">
            {visible.map((entry, index) => {
              const color = KIND_COLOR[entry.kind]
              return (
                <div key={`${entry.ts}-${index}`} className="flex items-center gap-2 py-[5px]">
                  <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="num w-[50px] shrink-0 text-[10px] text-ink-faint">
                    {formatTime(entry.ts)}
                  </span>
                  {entry.level ? (
                    <span
                      className="shrink-0 text-[11px] font-semibold"
                      style={{ color: entry.kind === 'alert' ? '#DC2626' : '#6B6B72' }}
                    >
                      {entry.level}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10.5px] text-ink-faint">{KIND_LABEL[entry.kind]}</span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[11px] text-ink-soft">
                    {entry.text || (entry.kind === 'sample' ? '·' : '')}
                  </span>
                  {entry.db !== null ? (
                    <span className="num shrink-0 text-[10.5px] text-ink-soft">{entry.db.toFixed(1)}</span>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-line/80 px-4 py-2">
        {message ? (
          <p className="truncate text-[10px] text-ink-soft">{message}</p>
        ) : (
          <p className="truncate text-[10px] text-ink-faint" title={logDir}>
            仅记录分贝数值与事件，不含音频 · {logDir || '日志目录'}
          </p>
        )}
      </footer>
    </div>
  )
}
