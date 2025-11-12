import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// apply saved or system theme before render
const saved = localStorage.getItem('theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
if (saved === 'dark' || (!saved && prefersDark)) {
  document.documentElement.classList.add('dark')
} else {
  document.documentElement.classList.remove('dark')
}

console.info('ENV check:', {
  BASE_ID: import.meta.env.VITE_AIRTABLE_BASE_ID,
  TABLE: import.meta.env.VITE_AIRTABLE_TABLE,
  TOKEN_PRESENT: Boolean(import.meta.env.VITE_AIRTABLE_TOKEN),
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)