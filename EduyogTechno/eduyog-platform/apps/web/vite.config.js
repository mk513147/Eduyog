import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Public base path of the deployed site. The hosting location is not decided yet, so it is
  // configurable at build time (e.g. VITE_BASE_PATH=/eduyog/). It must start and end with "/".
  // The router and every asset URL follow it.
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    // The shared brand assets live in ../../assets/shared (outside this app's root).
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
    // 5173 is Admin, 5174 Fitness and 5175 Eduyarp. The backend's FRONTEND_URL (CORS) must
    // include this origin for the browser to read API responses.
    port: 5176,
    strictPort: true,
  },
  preview: {
    port: 4176,
    strictPort: true,
  },
})
