import { useEffect, useRef } from 'react'
import { useRouter } from './useRouter'

// After the user navigates to another page (not on the first load, not for in-page anchors), moves
// focus to the main content so keyboard and screen-reader users start at the new page. Works when
// the layout mounts after the navigation (e.g. a lazy-loaded page).
export function useFocusMainOnNavigation(mainRef) {
  const { path, navigationCount } = useRouter()
  const latestCount = useRef(navigationCount)

  useEffect(() => {
    latestCount.current = navigationCount
  })

  useEffect(() => {
    if (latestCount.current > 0) mainRef.current?.focus({ preventScroll: true })
  }, [path, mainRef])
}
