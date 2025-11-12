// vite.config.js
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig(({ mode }) => {
  const frontendEnv = loadEnv(mode, __dirname, '')
  const rootEnv = loadEnv(mode, join(__dirname, '..'), '')
  const env = { ...rootEnv, ...frontendEnv }
  const val = (k) => (typeof env[k] === 'undefined' ? 'undefined' : JSON.stringify(env[k]))

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png'
        ],
        manifest: {
          name: 'Command Center',
          short_name: 'Command Center',
          description: 'Your task + scheduling command center',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          theme_color: '#002B56',
          background_color: '#FFFFFF',
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' }
          ]
        },
        devOptions: { enabled: false }
      })
    ],
    envDir: __dirname,
    define: {
      'import.meta.env.VITE_AIRTABLE_BASE_ID': val('VITE_AIRTABLE_BASE_ID'),
      'import.meta.env.VITE_AIRTABLE_TOKEN': val('VITE_AIRTABLE_TOKEN'),
      'import.meta.env.VITE_AIRTABLE_TABLE': val('VITE_AIRTABLE_TABLE'),
    },
  }
})