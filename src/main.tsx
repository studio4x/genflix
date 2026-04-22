import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (window.location.hostname === 'genflix-omega.vercel.app') {
  const targetUrl = new URL(window.location.href)
  targetUrl.protocol = 'https:'
  targetUrl.host = 'genflix-ten.vercel.app'
  window.location.replace(targetUrl.toString())
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
