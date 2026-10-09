import { eduyarpApi } from '../../api/endpoints'
import { CourseStatusBadge } from '../../components/Badge'
import { PageHeader } from '../../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState } from '../../components/States'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { useResource } from '../../hooks/useResource'
import { Link } from '../../router/Link'
import { formatDate } from '../../utils/format'

export default function TrainersPage() {
  const { data: trainers, error, loading, reload } = useResource(eduyarpApi.trainers.list)
  useAutoRefresh(reload, { enabled: Boolean(trainers) })

  let content
  if (loading) content = <LoadingState label="Loading trainers…" />
  else if (error && !trainers) content = <ErrorState error={error} onRetry={reload} />
  else if (trainers.length === 0)
    content = (
      <EmptyState
        title="No trainers yet"
        description="Trainers are ordinary user accounts with the Trainer role."
        action={
          <Link to="/users" className="btn btn--primary">
            Go to Users
          </Link>
        }
      />
    )
  else
    content = (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Trainer</th>
              <th scope="col">Assigned courses</th>
              <th scope="col">Joined</th>
            </tr>
          </thead>
          <tbody>
            {trainers.map((trainer) => (
              <tr key={trainer.id}>
                <td>
                  <div className="cell-primary">{trainer.fullName}</div>
                  <div className="cell-secondary cell-break">{trainer.email}</div>
                </td>
                <td>
                  {trainer.courses.length === 0 ? (
                    <span className="muted">Not assigned</span>
                  ) : (
                    <ul className="tag-list">
                      {trainer.courses.map((course) => (
                        <li key={course.id}>
                          <Link to={`/eduyarp/courses/${course.id}`}>{course.title}</Link>{' '}
                          <CourseStatusBadge status={course.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="cell-nowrap">{formatDate(trainer.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

  return (
    <>
      <PageHeader
        title="Eduyarp Trainers"
        description="Users with the Trainer role. Change roles on the Users page; assign trainers from a course."
      />
      {error && trainers && <Alert>Could not refresh the list: {error.message}</Alert>}
      <div className="card card--flush">{content}</div>
    </>
  )
}
