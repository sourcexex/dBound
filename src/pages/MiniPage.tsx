import { useEffect, useState } from 'react'
import { MINI_COMMAND_EVENT, MINI_STATE_EVENT, type MiniState } from '../lib/miniBridge'
import { isTauri } from '../lib/tauri'

const INITIAL: MiniState = {
  db: null,
  peak: null,
  color: '#17171A',
  name: null,
  mode: 'forward',
  modeLabel: '正向',
  title: 'dBound',
  subtitle: '',
  titleFont: 'system',
  titleSize: 20,
  titleColor: '#17171A',
  subtitleSize: 13,
  subtitleColor: '#6B6B72',
  statusFont: 'system',
  statusSize: 15,
  readoutAnimation: true,
  rollingMs: 600,
  readoutIntervalMs: 1000,
  emojiRule: null,
  running: false,
  paused: false,
}

export function MiniPage() {
  const [state, setState] = useState<MiniState>(INITIAL)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isTauri()) {
      setReady(true)
      return
    }
    let disposed = false
    let unlisten: (() => void) | undefined

    void (async () => {
      const { listen, emit } = await import('@tauri-apps/api/event')
      unlisten = await listen<MiniState>(MINI_STATE_EVENT, (event) => {
        if (!disposed) setState(event.payload)
      })
      await emit(MINI_COMMAND_EVENT, { command: 'mini-ready' })
      if (!disposed) setReady(true)
    })()

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  const openMain = () => {
    void (async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('show_main_window').catch(() => undefined)
    })()
  }

  const measuring = state.running && !state.paused
  const live = measuring && state.db !== null
  const accent = state.name ? state.color : '#17171A'
  const value = state.db === null ? null : state.db.toFixed(1)

  return (
    <div
      data-tauri-drag-region
      onClick={openMain}
      title="点击回到主窗口"
      className="relative flex h-full w-full items-center overflow-hidden rounded-[14px] border border-black/[0.09] bg-paper px-3.5 shadow-[0_6px_18px_rgba(0,0,0,0.14)]"
    >
      {live && state.name ? (
        <span
          aria-hidden
          className="dbound-breathe pointer-events-none absolute inset-[1px] rounded-[13px] border-2"
          style={{ borderColor: accent, opacity: 0.9 }}
        />
      ) : null}

      <span
        className="mr-2.5 h-[8px] w-[8px] shrink-0 rounded-full transition-colors duration-200"
        style={{ backgroundColor: measuring ? (state.name ? accent : '#B9B8B0') : '#D3D2CB' }}
      />

      {value !== null ? (
        <div className="flex min-w-0 flex-1 items-baseline gap-1">
          <span className="text-[11px] text-ink-faint">≈</span>
          <span
            className="num text-[26px] leading-none font-semibold tracking-[-0.02em] transition-colors duration-200"
            style={{ color: measuring ? (state.name ? accent : '#17171A') : '#9C9B94' }}
          >
            {value}
          </span>
          <span className="text-[9.5px] font-medium tracking-[0.08em] text-ink-soft">dB</span>
        </div>
      ) : (
        <span className="flex-1 text-[12.5px] font-medium text-ink-soft">
          {ready ? (state.paused ? '已暂停' : '未开始') : '连接中'}
        </span>
      )}

      {state.name ? (
        <span
          className="shrink-0 rounded-full px-1.5 py-[2px] text-[9px] font-semibold"
          style={{ backgroundColor: `${state.color}1f`, color: state.color }}
        >
          {state.name}
        </span>
      ) : null}
    </div>
  )
}
