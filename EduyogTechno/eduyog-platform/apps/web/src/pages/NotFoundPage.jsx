import { usePageTitle } from '../lib/usePageTitle'
import { Link } from '../router/Link'

export default function NotFoundPage() {
  usePageTitle('Page not found — Eduyog')
  return (
    <div className="container not-found">
      <p className="not-found__code">Error 404</p>
      <h1 className="not-found__title">This page could not be found</h1>
      <p className="not-found__text">
        The address may be mistyped or the page may have moved. You can return to the Eduyog homepage.
      </p>
      <Link to="/" className="btn btn--brand btn--lg">
        Back to the homepage
      </Link>
    </div>
  )
}
