import { leadsApi, platformsApi, servicesApi, usersApi } from '../api/endpoints'
import { PageHeader } from '../components/PageHeader'
import { Spinner } from '../components/States'
import { useResource } from '../hooks/useResource'
import { useAuth } from '../auth/useAuth'
import { Link } from '../router/Link'
import { formatDate } from '../utils/format'

function StatCard({ title, to, resource, summarize }) {
  const { data, error, loading, reload } = resource

  let body
  if (loading) {
    body = (
      <div className="stat__loading" role="status">
        <Spinner size="sm" /> Loading…
      </div>
    )
  } else if (error) {
    body = (
      <div className="stat__error" role="alert">
        <span>{error.message}</span>
        <button type="button" className="btn btn--secondary btn--sm" onClick={reload}>
          Retry
        </button>
      </div>
    )
  } else {
    const { detail, empty } = summarize(data)
    body = (
      <>
        <p className="stat__value">{data.length}</p>
        <p className="stat__detail">{data.length === 0 ? empty : detail}</p>
      </>
    )
  }

  return (
    <section className="card stat" aria-label={title}>
      <div className="stat__header">
        <h2 className="stat__title">{title}</h2>
        <Link to={to} className="stat__link">
          View
        </Link>
      </div>
      {body}
    </section>
  )
}

const countWhere = (list, predicate) => list.filter(predicate).length

export default function OverviewPage() {
  const { user } = useAuth()
  const users = useResource(usersApi.list)
  const platforms = useResource(platformsApi.list)
  const services = useResource(servicesApi.list)
  const leads = useResource(leadsApi.list)

  return (
    <>
      <PageHeader title="Overview" description={`Welcome back, ${user.fullName}.`} />
      <div className="stats">
        <StatCard
          title="Users"
          to="/users"
          resource={users}
          summarize={(list) => ({
            detail: `${countWhere(list, (u) => u.role === 'admin')} admin · ${countWhere(list, (u) => u.role === 'student')} student`,
            empty: 'No users yet',
          })}
        />
        <StatCard
          title="Platforms"
          to="/platforms"
          resource={platforms}
          summarize={(list) => ({
            detail: `${countWhere(list, (p) => p.isActive)} active · ${countWhere(list, (p) => !p.isActive)} inactive`,
            empty: 'No platforms added yet',
          })}
        />
        <StatCard
          title="Services"
          to="/services"
          resource={services}
          summarize={(list) => ({
            detail: `${countWhere(list, (s) => s.isActive)} active · ${countWhere(list, (s) => !s.isActive)} inactive`,
            empty: 'No services added yet',
          })}
        />
        <StatCard
          title="Fitness Leads"
          to="/fitness-leads"
          resource={leads}
          summarize={(list) => ({
            // The API returns leads newest first.
            detail: `Latest received ${formatDate(list[0]?.createdAt)}`,
            empty: 'No enquiries received yet',
          })}
        />
      </div>
    </>
  )
}
