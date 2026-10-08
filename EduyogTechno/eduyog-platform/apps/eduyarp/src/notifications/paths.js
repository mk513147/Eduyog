// Only an internal application path is ever followed from a notification
// ("/…" but never "//host" or an absolute URL).
export const isInternalPath = (path) =>
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
