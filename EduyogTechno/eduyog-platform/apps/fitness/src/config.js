// Returns a normalised http(s) URL string, or null for anything else
// (empty, relative, javascript:, malformed...).
function toHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

// Main Eduyog website, from VITE_EDUYOG_URL. There is no default: when it is
// not configured, the "Back to Eduyog" link is hidden.
export const EDUYOG_URL = toHttpUrl(import.meta.env.VITE_EDUYOG_URL)

if (import.meta.env.DEV && !EDUYOG_URL) {
  console.warn('[config] VITE_EDUYOG_URL is not set or invalid; the "Back to Eduyog" link is hidden.')
}

const DEV_API_URL = 'http://localhost:5000'

// Backend origin from VITE_API_URL, without the /api prefix or a trailing
// slash. Development falls back to the local backend; a production build has
// no default, so enquiries fail with an error until it is configured.
const configuredApiUrl = toHttpUrl(import.meta.env.VITE_API_URL)
const apiUrl = configuredApiUrl || (import.meta.env.DEV ? DEV_API_URL : '')
export const API_URL = apiUrl.replace(/\/+$/, '') || null

if (!configuredApiUrl) {
  console.warn(
    import.meta.env.DEV
      ? `[config] VITE_API_URL is not set or invalid; using ${DEV_API_URL}.`
      : '[config] VITE_API_URL is not set or invalid; enquiries cannot be sent.',
  )
}
