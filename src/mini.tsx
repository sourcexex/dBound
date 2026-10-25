import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MiniPage } from './pages/MiniPage'
import { initResourceAssets } from './lib/resourceAssets'
import './styles.css'

async function boot() {
  await initResourceAssets()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MiniPage />
    </StrictMode>,
  )
}

void boot()
