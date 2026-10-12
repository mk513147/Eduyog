import { Link } from '../router/Link'

// A plain text link back to the Eduyog homepage (the unified app's "/" route, so it follows VITE_BASE_PATH
// and keeps browser history working). It lives in the footers, as one ordinary link among the others;
// the colours come from the footer's own link styles (see styles/brand.css).
export function BackToEduyog({ className = '', onClick }) {
  return (
    <Link to="/" className={`eg-back${className ? ` ${className}` : ''}`} onClick={onClick}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M19 12H5M11 6l-6 6 6 6" />
      </svg>
      <span>Back to Eduyog</span>
    </Link>
  )
}
