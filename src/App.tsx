import { useEffect, useRef, useState } from 'react'
import { useLevelMonitor } from './hooks/useLevelMonitor'
import { flushLogs, initLogFlushHooks, logSystem } from './lib/logger'
import { showMiniWindow } from './lib/miniBridge'
import { LogsPage } from './pages/LogsPage'
import { MainPage } from './pages/MainPage'
import { SettingsPage } from './pages/SettingsPage'
import { useLevelStore } from './stores/level'

const APP_VERSION = '0.1.0'

export default function App() {
  const [view, setView] = useState<'main' | 'settings' | 'logs'>('main')
  const { toggle, start, restartDevice } = useLevelMonitor()
  const unseenAlerts = useLevelStore((state) => state.unseenAlerts)
  const started = useRef(false)

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

  if (view === 'settings') {
    return (
      <SettingsPage
        onBack={() => setView('main')}
        onRestartDevice={(deviceId) => {
          void restartDevice(deviceId)
        }}
      />
    )
  }

  if (view === 'logs') {
    return <LogsPage onBack={() => setView('main')} />
  }

  return (
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
      onOpenLogs={() => {
        useLevelStore.getState().clearUnseenAlerts()
        setView('logs')
      }}
      unseenLogs={unseenAlerts > 0}
    />
  )
}
