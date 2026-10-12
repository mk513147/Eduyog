import { useEffect } from 'react'
import { useRouter } from './useRouter'

export function Redirect({ to }) {
  const { navigate } = useRouter()
  useEffect(() => {
    navigate(to, { replace: true })
  }, [navigate, to])
  return null
}
