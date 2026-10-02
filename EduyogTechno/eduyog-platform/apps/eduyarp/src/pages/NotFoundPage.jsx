import { usePageTitle } from '../hooks/usePageTitle'
import { Link } from '../router/Link'

export default function NotFoundPage({ message = 'The page you are looking for does not exist.' }) {
  usePageTitle('Not found')
  return (
    <div className="container">
      <div className="state state--page">
        <p className="state__title">Page not found</p>
        <p className="state__text">{message}</p>
        <Link to="/courses" className="btn btn--primary">
          Browse courses
        </Link>
      </div>
    </div>
  )
}
