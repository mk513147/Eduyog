import { useCallback } from 'react'
import { studentApi } from '../../api/endpoints'
import { useResource } from '../../hooks/useResource'
import { Link } from '../../router/Link'
import { formatDateTime } from '../../utils/format'
import { submissionState } from '../../utils/assignments'
import { AssignmentStatusBadge } from '../Badges'
import { Icon } from '../Icon'
import { ErrorState, LoadingState } from '../States'

// The assignments a student can open for this course (published and closed), with their own state.
export function AssignmentsCard({ courseId }) {
  const loader = useCallback(() => studentApi.assignments(courseId), [courseId])
  const { data, error, loading, reload } = useResource(loader)

  return (
    <section className="card" aria-labelledby="extras-assignments">
      <h2 id="extras-assignments" className="card__title">
        <Icon name="edit" /> Assignments
      </h2>
      {loading && <LoadingState label="Loading assignments…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && <p className="muted">No assignments have been published for this course yet.</p>}
      {data && data.length > 0 && (
        <ul className="asg-list">
          {data.map((a) => {
            const state = submissionState(a)
            return (
              <li key={a.id} className="asg">
                <div className="asg__main">
                  <div className="asg__top">
                    <Link to={`/my-courses/${courseId}/assignments/${a.id}`} className="asg__title">
                      {a.title}
                    </Link>
                    <AssignmentStatusBadge status={a.status} />
                    <span className={`badge ${state.key === 'none' ? 'badge--muted' : state.key === 'late' ? 'badge--danger' : 'badge--primary'}`}>
                      {state.label}
                    </span>
                    {a.hasFeedback && <span className="badge badge--success">Feedback received</span>}
                  </div>
                  <p className="asg__meta">
                    {a.dueAt ? `Due ${formatDateTime(a.dueAt)}` : 'No due date'}
                    {a.topicTitle ? ` · Topic: ${a.topicTitle}` : a.moduleTitle ? ` · ${a.moduleTitle}` : ''}
                    {a.attempts > 1 ? ` · ${a.attempts} submissions` : ''}
                  </p>
                </div>
                <Link to={`/my-courses/${courseId}/assignments/${a.id}`} className="btn btn--secondary btn--sm">
                  {a.status === 'published' ? (state.key === 'none' ? 'Open and submit' : 'Open') : 'View'}
                  <span className="visually-hidden">: {a.title}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
