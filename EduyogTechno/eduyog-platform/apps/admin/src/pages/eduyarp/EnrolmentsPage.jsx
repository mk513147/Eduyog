import { eduyarpApi } from '../../api/endpoints'
import { EnrolmentStatusBadge } from '../../components/Badge'
import { PageHeader } from '../../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState } from '../../components/States'
import { useResource } from '../../hooks/useResource'
import { Link } from '../../router/Link'
import { formatDateTime } from '../../utils/format'

export default function EnrolmentsPage() {
  const { data: enrolments, error, loading, reload } = useResource(eduyarpApi.enrolments.list)

  let content
  if (loading) content = <LoadingState label="Loading enrolments…" />
  else if (error && !enrolments) content = <ErrorState error={error} onRetry={reload} />
  else if (enrolments.length === 0)
    content = (
      <EmptyState
        title="No enrolments yet"
        description="Students who enrol in a published course on Eduyarp will appear here."
      />
    )
  else
    content = (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Email</th>
              <th scope="col">Course</th>
              <th scope="col">Enrolled</th>
              <th scope="col">Status</th>
              <th scope="col">Progress</th>
            </tr>
          </thead>
          <tbody>
            {enrolments.map((enrolment) => (
              <tr key={enrolment.id}>
                <td className="cell-primary">{enrolment.student.fullName}</td>
                <td className="cell-break">{enrolment.student.email}</td>
                <td>
                  <Link to={`/eduyarp/courses/${enrolment.course.id}`}>{enrolment.course.title}</Link>
                </td>
                <td className="cell-nowrap">{formatDateTime(enrolment.enrolledAt)}</td>
                <td>
                  <EnrolmentStatusBadge status={enrolment.status} />
                </td>
                <td>
                  <div className="mini-progress" title={`${enrolment.progress.completedTopics} of ${enrolment.progress.totalTopics} topics`}>
                    <div className="mini-progress__track" aria-hidden="true">
                      <div className="mini-progress__fill" style={{ width: `${enrolment.progress.percent}%` }} />
                    </div>
                    <span>{enrolment.progress.percent}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

  return (
    <>
      <PageHeader
        title="Eduyarp Enrolments"
        description="All student enrolments, newest first. Cancelled enrolments are kept as history."
      />
      {error && enrolments && <Alert>Could not refresh the list: {error.message}</Alert>}
      <div className="card card--flush">{content}</div>
    </>
  )
}
