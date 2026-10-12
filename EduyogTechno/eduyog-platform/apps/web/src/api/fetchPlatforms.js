import { normalisePlatforms } from './platforms'
import { apiGet } from './client'

// GET /api/platforms, normalised. Rejects with ApiError (or an Error for an unexpected body).
export async function fetchPlatforms({ signal } = {}) {
  return normalisePlatforms(await apiGet('/platforms', { signal }))
}
