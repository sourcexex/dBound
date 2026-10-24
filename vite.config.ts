import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const entry = (name: string) => fileURLToPath(new URL(`./${name}`, import.meta.url))

// Tauri expects a fixed dev port; the frontend is a plain SPA served by Vite.
// Two entries: the main window and the mini floating capsule.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'chrome110',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: entry('index.html'),
        mini: entry('mini.html'),
        full: entry('full.html'),
      },
    },
  },
})
