import { useCallback, useEffect, useMemo, useState } from 'react'
import { BASE_PATH } from '../config'
import { parseTo, stripBase, withBase } from './paths'
import { RouterContext } from './RouterContext'

function currentLocation() {
  const { pathname, search, hash } = window.location
  // A URL outside the base path matches no route and renders the not-found page.
  return { path: stripBase(pathname, BASE_PATH) ?? pathname, search, hash }
}

function scrollToHash(hash) {
  if (hash) {
    let id = hash.slice(1)
    try {
      id = decodeURIComponent(id)
    } catch {
      // Use the raw fragment.
    }
    const target = document.getElementById(id)
    if (target) {
      target.scrollIntoView()
      return
    }
  }
  window.scrollTo(0, 0)
}

// Minimal History API router, in the same spirit as the Eduyarp and Admin apps (no routing library),
// with a configurable base path and hash scrolling. Route definitions live in ../routes.jsx.
export function RouterProvider({ children }) {
  const [location, setLocation] = useState(currentLocation)
  // Bumped by navigate() so the page scrolls to the new hash/top. Back/forward and plain #anchor
  // clicks are left to the browser's own scroll handling.
  const [scrollRequest, setScrollRequest] = useState(0)
  // Number of navigations since the page loaded (links and back/forward). 0 means the initial load.
  const [navigationCount, setNavigationCount] = useState(0)

  useEffect(() => {
    const onPopState = () => {
      setLocation(currentLocation())
      setNavigationCount((count) => count + 1)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Deep link such as /#contact on first load.
  useEffect(() => {
    if (window.location.hash) scrollToHash(window.location.hash)
  }, [])

  useEffect(() => {
    if (scrollRequest > 0) scrollToHash(window.location.hash)
  }, [scrollRequest])

  // `to` is an app path, e.g. "/", "/#education" or "/fitness?x=1".
  const navigate = useCallback((to, { replace = false } = {}) => {
    parseTo(to) // throws on unparsable input rather than navigating somewhere unexpected
    window.history[replace ? 'replaceState' : 'pushState'](null, '', withBase(to, BASE_PATH))
    setLocation(currentLocation())
    setScrollRequest((count) => count + 1)
    setNavigationCount((count) => count + 1)
  }, [])

  const value = useMemo(
    () => ({ path: location.path, search: location.search, hash: location.hash, navigationCount, navigate }),
    [location, navigationCount, navigate],
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}
