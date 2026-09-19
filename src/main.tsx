import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './ui/App'
import './ui/theme.css'
import './ui/app.css'

// Обновления забираются молча: приложение маленькое, спрашивать разрешения
// на перезагрузку кеша не за чем.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
