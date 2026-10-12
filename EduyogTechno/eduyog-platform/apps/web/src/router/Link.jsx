import { BASE_PATH } from '../config'
import { withBase } from './paths'
import { useRouter } from './useRouter'

// Client-side link for app paths ("/", "/#about"). The real href is rendered so open-in-new-tab,
// copy-link and no-JS crawlers keep working. For external URLs use a plain <a>.
export function Link({ to, onClick, children, ...props }) {
  const { navigate } = useRouter()

  const handleClick = (event) => {
    onClick?.(event)
    // Let the browser handle new-tab / modified clicks.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      props.target === '_blank'
    ) {
      return
    }
    event.preventDefault()
    navigate(to)
  }

  return (
    <a href={withBase(to, BASE_PATH)} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}
