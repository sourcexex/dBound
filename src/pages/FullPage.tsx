import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { AuroraBackground } from '../components/AuroraBackground'
import { RollingNumber } from '../components/RollingNumber'
import { Toast } from '../components/Toast'
import { MINI_STATE_EVENT, type MiniState } from '../lib/miniBridge'
import { EMOJI_MAX } from '../lib/settingsSchema'
import { isTauri } from '../lib/tauri'
import { accentFallback, dimmedNumber, mutedFallback } from '../lib/theme'
import { fontStackFor } from '../lib/titleFonts'

const EMOJI_POOL = [
  '😀', '😄', '😁', '😊', '🥳', '🤩', '😍', '😎', '🤗', '😆',
  '🎉', '👏', '🌟', '💪', '🐱', '🐶', '🌈', '☀️', '👍', '✨',
]

interface EmojiItem {
  id: number
  char: string
  x: number
  y: number
  size: number
  rot: number
  delay: number
  bob: number
}

let emojiSeq = 0

function pickX(existing: EmojiItem[]): number {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = 4 + Math.random() * 87
    if (existing.every((emoji) => Math.abs(emoji.x - candidate) > 5)) return candidate
  }
  return 4 + Math.random() * 87
}

function makeEmoji(existing: EmojiItem[] = []): EmojiItem {
  emojiSeq += 1
  // Size relative to the viewport so the faces stay chunky on big screens.
  const unit = (typeof window === 'undefined' ? 1280 : window.innerWidth) / 100
  return {
    id: emojiSeq,
    char: EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)],
    x: pickX(existing),
    y: 2 + Math.random() * 24,
    size: Math.round((2.8 + Math.random() * 2.8) * unit),
    rot: -10 + Math.random() * 20,
    delay: Math.random() * 1.2,
    bob: 1.9 + Math.random() * 1.2,
  }
}

function seedEmoji(count: number): EmojiItem[] {
  const list: EmojiItem[] = []
  for (let index = 0; index < count; index += 1) list.push(makeEmoji(list))
  return list
}

const INITIAL: MiniState = {
  db: null,
  peak: null,
  color: '#17171A',
  name: null,
  mode: 'forward',
  theme: 'aurora',
  darkMode: false,
  modeLabel: '正向',
  title: 'dBound',
  subtitle: '实时响度估测',
  titleFont: 'system',
  titleSize: 20,
  titleColor: '#17171A',
  subtitleSize: 13,
  subtitleColor: '#6B6B72',
  statusFont: 'system',
  statusSize: 15,
  statusColor: '',
  idleText: '音量正常',
  idleNumberColor: '',
  levelNameSize: 13,
  levelNoteSize: 12,
  levelNote: null,
  readoutAnimation: true,
  rollingMs: 600,
  readoutIntervalMs: 1000,
  emojiRule: null,
  running: false,
  paused: false,
  toast: null,
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
  const accent = state.name
    ? state.color
    : state.idleNumberColor || accentFallback(state.darkMode)
  const titleColor =
    state.darkMode && state.titleColor.toLowerCase() === '#17171a' ? '#F2F3F1' : state.titleColor
  const subtitleColor =
    state.darkMode && state.subtitleColor.toLowerCase() === '#6b6b72' ? '#A4A6AD' : state.subtitleColor
  const value = state.db === null ? null : state.db.toFixed(1)

  const [emojis, setEmojis] = useState<EmojiItem[]>([])
  const holdSinceRef = useRef<number | null>(null)
  const emojiRule = state.emojiRule

  // Reset + seed the bottom row whenever the mode (or its initial count) changes.
  useEffect(() => {
    holdSinceRef.current = null
    const initial = Math.min(emojiRule?.initial ?? 0, EMOJI_MAX)
    setEmojis(seedEmoji(initial))
  }, [state.mode, emojiRule?.initial])

  // Reward: hold the goal for N seconds → one more emoji pops in.
  useEffect(() => {
    // Only reward while the fullscreen window is actually on screen.
    if (
      document.visibilityState !== 'visible' ||
      !emojiRule ||
      !emojiRule.enabled ||
      !measuring ||
      state.db === null
    ) {
      holdSinceRef.current = null
      return
    }

    const qualifies =
      state.mode === 'reverse' ? state.db >= emojiRule.threshold : state.db <= emojiRule.threshold

    if (!qualifies) {
      holdSinceRef.current = null
      return
    }

    const now = performance.now()
    if (holdSinceRef.current === null) {
      holdSinceRef.current = now
      return
    }

    if (now - holdSinceRef.current >= emojiRule.holdSeconds * 1000) {
      holdSinceRef.current = now
      setEmojis((previous) =>
        previous.length >= EMOJI_MAX ? previous : [...previous, makeEmoji(previous)],
      )
    }
  }, [state.db, state.mode, measuring, emojiRule])

  const statusText = !state.running
    ? state.paused
      ? '已暂停'
      : '未开始测量'
    : state.idleText || (state.mode === 'forward' ? '安静' : '音量正常')

  return (
    <div
      onMouseMove={revealChrome}
      onClick={revealChrome}
      data-appearance={state.darkMode ? 'dark' : 'light'}
      data-theme={state.theme}
      className="relative h-screen w-screen overflow-hidden"
    >
      <AuroraBackground variant="fullscreen" theme={state.theme} dark={state.darkMode} />
      {/* soft colour wash driven by the active level */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          background: `radial-gradient(58% 52% at 50% 46%, ${accent}${state.name ? '22' : '0d'} 0%, transparent 70%)`,
          opacity: measuring ? 1 : 0.4,
        }}
      />

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-9 py-7">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="relative mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-[7px] bg-ink">
            <span className="h-[7px] w-[7px] rounded-full bg-[#F2C94C]" />
          </span>
          <div className="min-w-0">
            <h1
              className="truncate leading-tight font-semibold tracking-[0.01em]"
              style={{
                fontFamily: fontStackFor(state.titleFont),
                fontSize: `${state.titleSize}px`,
                color: titleColor,
              }}
            >
              {state.title || 'dBound'}
            </h1>
            {state.subtitle ? (
              <p
                className="mt-1 truncate font-medium tracking-[0.02em]"
                style={{
                  fontFamily: fontStackFor(state.titleFont),
                  fontSize: `${state.subtitleSize}px`,
                  color: subtitleColor,
                }}
              >
                {state.subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="flex items-center gap-4 transition-opacity duration-500"
          style={{ opacity: chromeVisible ? 1 : 0 }}
        >
          <span className="text-[11px] tracking-[0.06em] text-ink-faint">按 ESC 退出</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              exit()
            }}
            aria-label="退出全屏"
            className="grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-ink/[0.06] hover:text-ink"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      </header>

      {state.toast ? <Toast bottom="56px" /> : null}

      {/* emoji reward row */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[34vh] overflow-hidden"
      >
        {emojis.map((emoji) => (
          <span
            key={emoji.id}
            className="absolute"
            style={{
              left: `${emoji.x}%`,
              bottom: `${emoji.y}%`,
              transform: `rotate(${emoji.rot}deg)`,
            }}
          >
            <span
              className="inline-block"
              style={{ animation: `dbound-emoji-bob ${emoji.bob}s ease-in-out ${emoji.delay}s infinite` }}
            >
              <span
                className="inline-block select-none"
                style={{
                  fontSize: `${emoji.size}px`,
                  lineHeight: 1,
                  fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
                  animation: 'dbound-emoji-pop 520ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
                }}
              >
                {emoji.char}
              </span>
            </span>
          </span>
        ))}
      </div>

      <main className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative flex items-start justify-center">
          {value !== null ? (
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 h-[38%] w-[104%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[95px] transition-opacity duration-700"
              style={{
                backgroundColor: measuring ? accent : accentFallback(state.darkMode),
                opacity: state.name ? 0.26 : 0.13,
              }}
            />
          ) : null}
          {value === null ? (
            <span
              className="num font-semibold tracking-[0.06em] text-ink-faint"
              style={{ fontSize: 'min(16vh, 12vw)' }}
            >
              ––
            </span>
          ) : (
            <span
              className="relative inline-flex items-center"
              style={{ fontSize: 'min(34vh, 26vw)' }}
            >
              <span
                aria-hidden
                className="absolute top-[0.14em] right-full pr-[0.16em] text-[0.11em] font-normal text-ink-faint"
              >
                ≈
              </span>
              <RollingNumber
                value={state.db}
                animate={state.readoutAnimation}
                durationMs={state.rollingMs}
                refreshMs={state.readoutIntervalMs}
                className="num font-semibold tracking-[-0.03em] transition-colors duration-300"
                style={{ color: measuring ? accent : dimmedNumber(state.darkMode) }}
              />
            </span>
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
            style={{ backgroundColor: state.name ? accent : mutedFallback(state.darkMode) }}
          />
          {state.name ? (
            <>
              <span
                className="font-semibold"
                style={{
                  fontFamily: fontStackFor(state.statusFont),
                  fontSize: `${state.levelNameSize}px`,
                  color: state.color,
                }}
              >
                {state.name}
              </span>
              {state.levelNote ? (
                <>
                  <span className="text-ink-faint">·</span>
                  <span
                    className="font-medium"
                    style={{
                      fontFamily: fontStackFor(state.statusFont),
                      fontSize: `${state.levelNoteSize}px`,
                      color: state.color,
                    }}
                  >
                    {state.levelNote}
                  </span>
                </>
              ) : null}
            </>
          ) : (
            <span
              className="font-semibold text-ink"
              style={{
                fontFamily: fontStackFor(state.statusFont),
                fontSize: `${state.statusSize}px`,
                color: state.statusColor || undefined,
              }}
            >
              {statusText}
            </span>
          )}
        </div>
      </main>

      <footer
        className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-6 pb-8 text-[11.5px] tracking-[0.02em] text-ink-faint transition-opacity duration-500"
        style={{ opacity: chromeVisible ? 1 : 0 }}
      >
        <span className="num">
          {state.peak !== null ? `峰值 ${state.peak.toFixed(1)} dB` : '等待数据'}
        </span>
        <span className="h-3 w-px bg-ink/10" />
        <span>估测值，仅供感知参考</span>
      </footer>
    </div>
  )
}
