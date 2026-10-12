import { API_BASE_URL } from '../config'
import { createApiClient } from './createClient'

export { ApiError } from './createClient'

// The app's API client, configured from VITE_API_BASE_URL (see config.js). All requests go through
// it: there is no other API address anywhere in the app.
const client = createApiClient({ baseUrl: API_BASE_URL })

/** GET a JSON endpoint below the API base, e.g. apiGet('/platforms'). */
export const apiGet = client.get

/** POST a JSON body, e.g. apiPost('/fitness-leads', values). */
export const apiPost = client.post
