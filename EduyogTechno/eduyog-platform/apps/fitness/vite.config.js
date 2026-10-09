import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The shared brand assets live in ../../assets/shared (outside this app's root).
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
    // 5173 is used by the Admin app.
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
})
