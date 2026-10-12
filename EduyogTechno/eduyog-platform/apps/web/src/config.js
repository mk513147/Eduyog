import { normaliseApiBase, toAppPath, toHttpUrl } from './lib/url'

// Backend API base URL, including the /api prefix, from VITE_API_BASE_URL. There is deliberately
// no default (not even for development): when it is not set to an http(s) URL, no API request is
// made. See .env.example.
export const API_BASE_URL = normaliseApiBase(import.meta.env.VITE_API_BASE_URL)

// Optional destination of the "Become a Partner" buttons: an http(s) URL or an app path. A
// configured value that is neither is ignored (and reported in development).
const rawFitnessUrl = (import.meta.env.VITE_FITNESS_URL || '').trim()
export const FITNESS_URL = toHttpUrl(rawFitnessUrl) || toAppPath(rawFitnessUrl)

// Public base path the site is served from ("" or "/something"), without a trailing slash.
export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, '')

// Official contact details of Eduyog Techno Solution Pvt. Ltd., carried over from the approved
// homepage (websites/eduyog/index.html).
export const CONTACT_EMAIL = 'eduyogtechnology@gmail.com'
export const WHATSAPP_URL =
  'https://wa.me/917295993480?text=Hi%20Eduyog%2C%20I%20would%20like%20to%20know%20more.'

if (import.meta.env.DEV) {
  if (!API_BASE_URL) {
    console.warn('[config] VITE_API_BASE_URL is not set or is not an http(s) URL; platform links will not be loaded.')
  }
  if (rawFitnessUrl && !FITNESS_URL) {
    console.warn('[config] VITE_FITNESS_URL is neither an http(s) URL nor an app path starting with "/"; it is ignored.')
  }
}
