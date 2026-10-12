import { Link as ShellLink } from '../../../router/Link'
import { useRouter } from './useRouter'

// The shell's client-side link plus aria-current="page" on the link to the current page.
export function Link({ to, onClick, children, ...props }) {
  const { path } = useRouter()
  return (
    <ShellLink to={to} onClick={onClick} aria-current={path === to ? 'page' : undefined} {...props}>
      {children}
    </ShellLink>
  )
}
