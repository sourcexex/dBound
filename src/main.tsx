import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initResourceAssets } from './lib/resourceAssets'
import './styles.css'

async function boot() {
  await initResourceAssets()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
