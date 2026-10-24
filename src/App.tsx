import { useState } from 'react'
import { useLevelMonitor } from './hooks/useLevelMonitor'
import { showMiniWindow } from './lib/miniBridge'
import { MainPage } from './pages/MainPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  const [view, setView] = useState<'main' | 'settings'>('main')
  const { toggle, start, restartDevice } = useLevelMonitor()

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
    />
  )
}
