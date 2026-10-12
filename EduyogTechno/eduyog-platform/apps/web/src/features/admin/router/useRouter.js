import { useMemo } from 'react'
import { useRouter as useShellRouter } from '../../../router/useRouter'

// Adapter over the unified shell router with the shape the Admin pages were written for:
// { path, navigate }. `path` is the unified path ("/admin/users") without a trailing slash.
export function useRouter() {
  const { path: rawPath, navigate: shellNavigate } = useShellRouter()
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath
  return useMemo(
    () => ({
      path,
      // Navigating to the current path does nothing, as in the standalone app.
      navigate: (to, options) => {
        if (to === path) return
        shellNavigate(to, options)
      },
    }),
    [path, shellNavigate],
  )
}
