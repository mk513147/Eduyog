import { Link } from '../router/Link'
import { BrandLogo } from './BrandLogo'

// The Eduyog logo as a link to the Eduyog homepage (the unified app's "/" route, so it follows
// VITE_BASE_PATH). Used in the Eduyarp and Fitness navigation bars, where the product name next to
// the logo keeps linking to the product's own home.
export function EduyogHomeLink({ logoClassName, onClick }) {
  return (
    <Link to="/" className="eduyog-home-link" aria-label="Eduyog home" onClick={onClick}>
      <BrandLogo className={logoClassName} />
    </Link>
  )
}
