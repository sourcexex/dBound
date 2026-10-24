import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MiniPage } from './pages/MiniPage'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MiniPage />
  </StrictMode>,
)
