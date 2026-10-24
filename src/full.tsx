import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FullPage } from './pages/FullPage'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FullPage />
  </StrictMode>,
)
