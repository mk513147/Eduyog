import { toHttpUrl } from '../lib/url.js'

const normaliseKey = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '')

// GET /api/platforms returns { platforms: [{ name, slug, url, ... }] } (active platforms only).
// Keeps well-formed items and only the fields the page uses; url is null unless it is http(s).
export function normalisePlatforms(data) {
  if (!data || !Array.isArray(data.platforms)) throw new Error('Unexpected response format')
  const result = []
  for (const item of data.platforms) {
    if (!item || typeof item.name !== 'string' || item.name.trim() === '') continue
    result.push({
      name: item.name.trim(),
      slug: normaliseKey(item.slug),
      url: toHttpUrl(item.url),
    })
  }
  return result
}

// Finds the platform for a card: by slug first, then by name.
export function findPlatform(platforms, { slug, name }) {
  const wantedSlug = normaliseKey(slug)
  const wantedName = normaliseKey(name)
  return (
    (wantedSlug && platforms.find((platform) => platform.slug === wantedSlug)) ||
    (wantedName && platforms.find((platform) => normaliseKey(platform.name) === wantedName)) ||
    null
  )
}
