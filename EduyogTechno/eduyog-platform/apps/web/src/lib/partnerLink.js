import { toAppPath, toHttpUrl } from './url.js'

// The unified Fitness page (see routes.js).
export const DEFAULT_PARTNER_PATH = '/fitness'

/**
 * Where the "Become a Partner" buttons go: the unified /fitness page, unless VITE_FITNESS_URL
 * overrides it with another app path or an http(s) URL. There is no e-mail or external fallback:
 * the internal route always exists. Returns { kind: 'internal' | 'external', href }.
 */
export function resolvePartnerLink({ configuredUrl, defaultPath = DEFAULT_PARTNER_PATH }) {
  const path = toAppPath(configuredUrl)
  if (path) return { kind: 'internal', href: path }
  const external = toHttpUrl(configuredUrl)
  if (external) return { kind: 'external', href: external }
  return { kind: 'internal', href: defaultPath }
}
