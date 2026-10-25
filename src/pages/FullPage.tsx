import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { MINI_STATE_EVENT, type MiniState } from '../lib/miniBridge'
import { isTauri } from '../lib/tauri'

const INITIAL: MiniState = {
  db: null,
  peak: null,
  color: '#17171A',
  name: null,
  mode: 'forward',
  modeLabel: '正向',
  title: 'dBound',
  subtitle: '实时响度估测',
  running: false,
  paused: false,
}

const CHROME_HIDE_MS = 3200

export function FullPage() {
  const [state, setState] = useState<MiniState>(INITIAL)
  const [chromeVisible, setChromeVisible] = useState(true)
  const hideTimer = useRef(0)

  const exit = () => {
    void (async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('show_main_window').catch(() => undefined)
    })()
  }

  // Keep the chrome tucked away during a presentation; any mouse move brings it back.
  const revealChrome = () => {
    setChromeVisible(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setChromeVisible(false), CHROME_HIDE_MS)
  }

  useEffect(() => {
    revealChrome()
    return () => window.clearTimeout(hideTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        exit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!isTauri()) return
    let disposed = false
    let unlisten: (() => void) | undefined
    void (async () => {
      const { listen } = await import('@tauri-apps/api/event')
      unlisten = await listen<MiniState>(MINI_STATE_EVENT, (event) => {
        if (!disposed) setState(event.payload)
      })
    })()
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  const measuring = state.running && !state.paused
  const accent = state.name ? state.color : '#17171A'
  const value = state.db === null ? null : state.db.toFixed(1)
  const statusText = !state.running
    ? state.paused
      ? '已暂停'
      : '未开始测量'
    : state.name
      ? `${state.name} · ${state.modeLabel}`
      : state.mode === 'forward'
        ? '安静'
        : '音量正常'

  return (
    <div
      onMouseMove={revealChrome}
      onClick={revealChrome}
      className="relative h-screen w-screen overflow-hidden bg-paper"
    >
      {/* soft colour wash driven by the active level */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          background: `radial-gradient(58% 52% at 50% 46%, ${accent}${state.name ? '22' : '0d'} 0%, transparent 70%)`,
          opacity: measuring ? 1 : 0.4,
        }}
      />

      <header
        className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-9 py-7 transition-opacity duration-500"
        style={{ opacity: chromeVisible ? 1 : 0 }}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="relative mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-[7px] bg-ink">
            <span className="h-[7px] w-[7px] rounded-full bg-[#F2C94C]" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[19px] leading-tight font-semibold tracking-[0.01em] text-ink">
              {state.title || 'dBound'}
            </h1>
            {state.subtitle ? (
              <p className="mt-1 truncate text-[12px] font-medium tracking-[0.02em] text-ink-soft">
                {state.subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[11px] tracking-[0.06em] text-ink-faint">按 ESC 退出</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              exit()
            }}
            aria-label="退出全屏"
            className="grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-black/[0.06] hover:text-ink"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      </header>

      <main className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-start justify-center">
          {value === null ? (
            <span
              className="num font-semibold tracking-[0.06em] text-[#CBCAC3]"
              style={{ fontSize: 'min(16vh, 12vw)' }}
            >
              ––
            </span>
          ) : (
            <>
              <span
                className="mt-[0.16em] mr-[0.06em] font-normal text-ink-faint"
                style={{ fontSize: 'min(4vh, 3vw)' }}
              >
                ≈
              </span>
              <span
                className="num font-semibold tracking-[-0.045em] transition-colors duration-300"
                style={{ fontSize: 'min(34vh, 26vw)', lineHeight: 0.86, color: measuring ? accent : '#A9A8A1' }}
              >
                {value}
              </span>
            </>
          )}
        </div>

        <div
          className="mt-2 font-medium tracking-[0.34em] text-ink-soft"
          style={{ fontSize: 'min(2.4vh, 1.8vw)' }}
        >
          dB
        </div>

        <div className="mt-[3.2vh] flex items-center gap-2.5">
          <span
            className="h-[9px] w-[9px] rounded-full transition-colors duration-300"
            style={{ backgroundColor: state.name ? accent : '#C7C6BE' }}
          />
          <span className="text-[15px] font-semibold text-ink">{statusText}</span>
          {state.name ? (
            <span className="text-[13.5px] text-ink-soft">
              · {state.mode === 'forward' ? '声音偏大' : '声音偏小'}
            </span>
          ) : null}
        </div>
      </main>

      <footer
        className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-6 pb-8 text-[11.5px] tracking-[0.02em] text-ink-faint transition-opacity duration-500"
        style={{ opacity: chromeVisible ? 1 : 0 }}
      >
        <span className="num">
          {state.peak !== null ? `峰值 ${state.peak.toFixed(1)} dB` : '等待数据'}
        </span>
        <span className="h-3 w-px bg-black/10" />
        <span>估测值，仅供感知参考</span>
      </footer>
    </div>
  )
}
