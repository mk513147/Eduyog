import { useCallback } from 'react'
import { trainerApi } from '../api/endpoints'
import { EnrolmentStatusBadge } from '../components/Badges'
import { Icon } from '../components/Icon'
import { ProgressBar } from '../components/ProgressBar'
import { ErrorState, LoadingState } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import { formatShortDate } from '../utils/format'
import NotFoundPage from './NotFoundPage'

export default function TrainerStudentPage({ params }) {
  const loader = useCallback(() => trainerApi.student(params.courseId, params.studentId), [params.courseId, params.studentId])
  const { data, error, loading, reload } = useResource(loader)
  usePageTitle(data?.student.fullName ?? 'Student')

  if (loading) return <LoadingState label="Loading student…" />
  if (error?.status === 400 || error?.status === 403 || error?.status === 404)
    return <NotFoundPage message="This student is not currently enrolled in one of your courses." />
  if (error && !data) return <ErrorState error={error} onRetry={reload} />

  const { student, modules } = data
  return (
    <div className="container page">
      <Link to={`/trainer/courses/${params.courseId}`} className="back-link back-link--dark">
        <Icon name="arrowLeft" size={16} /> Back to course
      </Link>

      <header className="t-head card">
        <div className="my-course__badges">
          <EnrolmentStatusBadge status={student.enrolmentStatus} />
        </div>
        <h1 className="page__title">{student.fullName}</h1>
        <p className="meta break">{student.email}</p>
        <p className="muted small">
          Enrolled {formatShortDate(student.enrolledAt)}
          {student.lastActivityAt && ` · Last activity ${formatShortDate(student.lastActivityAt)}`}
        </p>
        <div className="t-head__progress">
          <ProgressBar progress={student.progress} />
        </div>
      </header>

      <section className="card" aria-labelledby="t-topics-title">
        <h2 id="t-topics-title" className="card__title">
          <Icon name="target" /> Progress by topic
        </h2>
        {modules.length === 0 ? (
          <p className="muted">This course has no topics yet.</p>
        ) : (
          <ol className="t-outline">
            {modules.map((module, index) => {
              const done = module.topics.filter((t) => t.completed).length
              return (
                <li key={module.id} className="t-outline__module">
                  <div className="t-outline__summary t-outline__summary--static">
                    <span className="curriculum__number">Module {index + 1}</span>
                    <span className="t-outline__title">{module.title}</span>
                    <span className="muted small">
                      {done}/{module.topics.length} completed
                    </span>
                  </div>
                  <ul className="t-topics">
                    {module.topics.map((topic) => (
                      <li key={topic.id} className={`t-topic${topic.completed ? ' t-topic--done' : ''}`}>
                        <Icon name={topic.completed ? 'topicDone' : 'topicOpen'} size={20} />
                        <span className="t-topic__title">{topic.title}</span>
                        <span className="t-topic__state">
                          {topic.completed ? `Completed ${formatShortDate(topic.completedAt)}` : 'Not completed'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
