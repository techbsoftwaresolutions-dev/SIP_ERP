import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // The mounted output folder can't have files deleted/renamed once written,
    // so avoid vite's default "empty dist before build" step.
    emptyOutDir: false,
  },
})
