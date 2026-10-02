// Splits an ApiError into per-field messages (from error.details) and a
// form-level message, as in the Admin app.
export function splitApiError(error, fields) {
  const fieldErrors = {}
  const extra = []
  if (error?.details && typeof error.details === 'object') {
    for (const [key, message] of Object.entries(error.details)) {
      if (fields.includes(key) && typeof message === 'string') fieldErrors[key] = message
      else if (typeof message === 'string') extra.push(message)
    }
  }
  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  let formError = null
  if (extra.length > 0) formError = extra.join(' ')
  else if (!hasFieldErrors) formError = error?.message || 'Something went wrong.'
  return { fieldErrors, formError }
}
