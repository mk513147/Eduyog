import { useRouter } from './useRouter'

export function Link({ to, onClick, children, ...props }) {
  const { path, navigate } = useRouter()

  const handleClick = (event) => {
    onClick?.(event)
    // Let the browser handle new-tab / modified clicks.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    event.preventDefault()
    navigate(to)
  }

  return (
    <a href={to} onClick={handleClick} aria-current={path === to ? 'page' : undefined} {...props}>
      {children}
    </a>
  )
}
