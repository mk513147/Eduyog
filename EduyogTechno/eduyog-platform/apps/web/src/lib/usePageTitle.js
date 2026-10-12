import { useEffect } from 'react'

// Sets document.title (and, when given, the meta description) for the current page and puts the
// previous values back when the page unmounts.
export function usePageMeta({ title, description }) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    const meta = description ? document.querySelector('meta[name="description"]') : null
    const previousDescription = meta?.getAttribute('content')
    if (meta) meta.setAttribute('content', description)

    return () => {
      document.title = previousTitle
      if (meta && previousDescription !== null && previousDescription !== undefined) {
        meta.setAttribute('content', previousDescription)
      }
    }
  }, [title, description])
}

export function usePageTitle(title) {
  usePageMeta({ title })
}
