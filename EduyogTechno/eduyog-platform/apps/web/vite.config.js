import react from '@vitejs/plugin-react'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { normaliseApiBase } from './src/lib/url.js'

// StudentAQ is a static site served from public/, which Vite does not process, so it cannot read
// VITE_API_BASE_URL itself. This plugin generates its settings file (studentaq/assets/js/site-config.js)
// from the same variable the React apps use: served by the dev server, written into dist on build.
// An unset or invalid value gives an empty apiBaseUrl, and the StudentAQ form then reports an error.
const STUDENTAQ_CONFIG = 'studentaq/assets/js/site-config.js'

function studentaqSiteConfig() {
  let config
  const source = () => {
    const apiBaseUrl = normaliseApiBase(loadEnv(config.mode, config.envDir, 'VITE_').VITE_API_BASE_URL) || ''
    return `window.EDUYOG_CONFIG = ${JSON.stringify({ apiBaseUrl })};
`
  }
  return {
    name: 'studentaq-site-config',
    configResolved(resolved) {
      config = resolved
    },
    configureServer(server) {
      const url = `${config.base}${STUDENTAQ_CONFIG}`
      server.middlewares.use((req, res, next) => {
        if (req.url.split('?')[0] !== url) return next()
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(source())
      })
    },
    closeBundle() {
      if (config.command !== 'build') return
      const file = resolve(config.root, config.build.outDir, STUDENTAQ_CONFIG)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, source())
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), studentaqSiteConfig()],
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
