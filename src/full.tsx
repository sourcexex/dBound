import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FullPage } from './pages/FullPage'
import { initResourceAssets } from './lib/resourceAssets'
import './styles.css'

async function boot() {
  await initResourceAssets()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <FullPage />
    </StrictMode>,
  )
}

void boot()
