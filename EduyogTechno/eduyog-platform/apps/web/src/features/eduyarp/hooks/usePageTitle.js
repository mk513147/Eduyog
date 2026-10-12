import { useEffect } from 'react'

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Eduyarp` : 'Eduyarp · Professional Training by Eduyog'
  }, [title])
}
