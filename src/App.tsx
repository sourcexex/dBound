import { useLevelMonitor } from './hooks/useLevelMonitor'
import { MainPage } from './pages/MainPage'

export default function App() {
  const { toggle, start } = useLevelMonitor()

  return (
    <MainPage
      onToggle={() => {
        void toggle()
      }}
      onStart={() => {
        void start()
      }}
    />
  )
}
