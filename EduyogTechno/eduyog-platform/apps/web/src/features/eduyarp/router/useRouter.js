import { useMemo } from 'react'
import { useRouter as useShellRouter } from '../../../router/useRouter'

// Adapter over the unified shell router with the shape the Eduyarp pages were written for:
// { path, fullPath, query, navigate }. Paths are unified paths (e.g. "/eduyarp/courses").
export function useRouter() {
  const { path, search, navigate: shellNavigate } = useShellRouter()
  return useMemo(() => {
    const fullPath = path + search
    return {
      path,
      fullPath,
      query: new URLSearchParams(search),
      // Navigating to the current URL does nothing, as in the standalone app.
      navigate: (to, options) => {
        if (to === fullPath) return
        shellNavigate(to, options)
      },
    }
  }, [path, search, shellNavigate])
}
