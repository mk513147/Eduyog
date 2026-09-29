import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/States'
import { Link } from '../router/Link'

export default function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <div className="card">
        <EmptyState
          title="This page does not exist"
          action={
            <Link to="/" className="btn btn--primary">
              Go to Overview
            </Link>
          }
        />
      </div>
    </>
  )
}
