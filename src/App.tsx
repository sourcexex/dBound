import { useEffect, useRef, useState } from 'react'
import { AuroraBackground } from './components/AuroraBackground'
import { Toast } from './components/Toast'
import { useLevelMonitor } from './hooks/useLevelMonitor'
import { flushLogs, initLogFlushHooks, logSystem } from './lib/logger'
import { showFullscreen, showMiniWindow } from './lib/miniBridge'
import { LogsPage } from './pages/LogsPage'
import { MainPage } from './pages/MainPage'
import { SettingsPage } from './pages/SettingsPage'
import { ActivationPage } from './pages/ActivationPage'
import { isTauri } from './lib/tauri'
import { useLevelStore } from './stores/level'
import { useSettingsStore } from './stores/settings'

const APP_VERSION = '1.0.1 Beta2'

export default function App() {
  const [view, setView] = useState<'main' | 'settings' | 'logs'>('main')
  const { toggle, start, restartDevice } = useLevelMonitor()
  const unseenAlerts = useLevelStore((state) => state.unseenAlerts)
  const theme = useSettingsStore((state) => state.theme)
  const darkMode = useSettingsStore((state) => state.darkMode)
  const started = useRef(false)
  const [license, setLicense] = useState<'checking' | 'ok' | 'locked'>('checking')

  useEffect(() => {
    let cancelled = false
    if (!isTauri()) {
      setLicense('ok')
      return
    }
    void (async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const active = await invoke<boolean>('license_status').catch(() => false)
      if (!cancelled) setLicense(active ? 'ok' : 'locked')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const dispose = initLogFlushHooks()
    if (!started.current) {
      started.current = true
      logSystem(`应用启动 v${APP_VERSION} · Windows`)
    }
    return () => {
      flushLogs()
      dispose()
    }
  }, [])

  useEffect(() => {
    let timer = 0
    const onScroll = () => {
      document.documentElement.dataset.scrolling = 'true'
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        delete document.documentElement.dataset.scrolling
      }, 180)
    }
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.clearTimeout(timer)
      delete document.documentElement.dataset.scrolling
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        event.preventDefault()
        void showFullscreen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const content =
    view === 'settings' ? (
      <SettingsPage
        onBack={() => setView('main')}
        onRestartDevice={(deviceId) => {
          void restartDevice(deviceId)
        }}
      />
    ) : view === 'logs' ? (
      <LogsPage onBack={() => setView('main')} />
    ) : (
      <MainPage
        onToggle={() => {
          void toggle()
        }}
        onStart={() => {
          void start()
        }}
        onOpenSettings={() => setView('settings')}
        onOpenMini={() => {
          void showMiniWindow()
        }}
        onOpenFullscreen={() => {
          void showFullscreen()
        }}
        onOpenLogs={() => {
          useLevelStore.getState().clearUnseenAlerts()
          setView('logs')
        }}
        unseenLogs={unseenAlerts > 0}
      />
    )

  const shell = (body: React.ReactNode) => (
    <div
      data-appearance={darkMode ? 'dark' : 'light'}
      data-theme={theme}
      className="relative h-full w-full overflow-hidden rounded-[15px] border border-ink/[0.08]"
    >
      <AuroraBackground theme={theme} dark={darkMode} />
      <div className="relative z-10 h-full">{body}</div>
      <Toast />
    </div>
  )

  // Render immediately (the license read takes ~1 ms); the activation gate only
  // replaces the UI when the marker is actually missing.
  const body = license === 'locked' ? <ActivationPage onActivated={() => setLicense('ok')} /> : content
  return shell(body)
}
