const URL_ERROR = 'Enter a valid http:// or https:// image address (no username or password).'

/**
 * Quick client-side check, mirroring the backend rules. The backend is the authority; this only
 * stops obviously unsafe or malformed values from being previewed or submitted.
 * Returns null for empty or valid values, otherwise a message.
 */
export function checkImageUrl(value) {
  const url = value.trim()
  if (url === '') return null
  if (url.length > 2048) return 'This address is too long (2048 characters at most).'
  if (!/^https?:\/\//i.test(url) || /\s/.test(url)) return URL_ERROR
  try {
    const parsed = new URL(url)
    if (!parsed.hostname || parsed.username || parsed.password) return URL_ERROR
  } catch {
    return URL_ERROR
  }
  return null
}
