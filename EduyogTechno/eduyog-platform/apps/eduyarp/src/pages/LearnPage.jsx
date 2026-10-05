import { useCallback, useState } from 'react'
import { studentApi } from '../api/endpoints'
import { EnrolmentStatusBadge, LevelBadge } from '../components/Badges'
import { Icon } from '../components/Icon'
import { ProgressBar } from '../components/ProgressBar'
import { Alert, ErrorState, LoadingState, Spinner } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import { formatShortDate } from '../utils/format'
import NotFoundPage from './NotFoundPage'

function TopicItem({ topic, busy, onComplete }) {
  return (
    <li className={`topic${topic.completed ? ' topic--done' : ''}`}>
      <span className="topic__check" aria-hidden="true">
        {topic.completed && <Icon name="check" size={14} />}
      </span>
      <div className="topic__body">
        <span className="topic__title">{topic.title}</span>
        {topic.description && <span className="topic__text">{topic.description}</span>}
        {topic.completed && (
          <span className="topic__meta">Completed {formatShortDate(topic.completedAt)}</span>
        )}
      </div>
      {topic.completed ? (
        <span className="visually-hidden">Completed</span>
      ) : (
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => onComplete(topic)}
          disabled={busy}
        >
          {busy && <Spinner size="sm" />}
          Mark complete
          <span className="visually-hidden">: {topic.title}</span>
        </button>
      )}
      {topic.videoEmbedUrl && (
        <div className="topic__video">
          <iframe
            src={topic.videoEmbedUrl}
            title={`Video: ${topic.title}`}
            loading="lazy"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
    </li>
  )
}

export default function LearnPage({ params }) {
  const loader = useCallback(() => studentApi.course(params.courseId), [params.courseId])
  const { data: course, error, loading, reload, setData } = useResource(loader)
  usePageTitle(course?.title ?? 'My course')
  const [busyTopicId, setBusyTopicId] = useState(null)
  const [actionError, setActionError] = useState(null)

  // The API returns the recalculated progress; apply it without a reload.
  const completeTopic = async (topic) => {
    setBusyTopicId(topic.id)
    setActionError(null)
    try {
      const result = await studentApi.completeTopic(topic.id)
      setData((prev) => ({
        ...prev,
        enrolment: { ...prev.enrolment, status: result.enrolmentStatus, progress: result.progress },
        modules: prev.modules.map((module) => ({
          ...module,
          topics: module.topics.map((t) =>
            t.id === topic.id ? { ...t, completed: true, completedAt: result.completedAt } : t,
          ),
        })),
      }))
    } catch (err) {
      setActionError(`Could not save your progress: ${err.message}`)
    } finally {
      setBusyTopicId(null)
    }
  }

  if (loading) return <LoadingState label="Loading your course…" />
  if (error?.status === 404 || error?.status === 400)
    return <NotFoundPage message="This course is not in your enrolments." />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { progress } = course.enrolment

  return (
    <div className="container page">
      <Link to="/dashboard" className="back-link back-link--dark">
        <Icon name="arrowLeft" size={16} /> My dashboard
      </Link>

      <header className="learn__header card">
        <div className="learn__heading">
          <div className="my-course__badges">
            <LevelBadge level={course.level} />
            <EnrolmentStatusBadge status={course.enrolment.status} />
          </div>
          <h1 className="page__title">{course.title}</h1>
          {course.trainers.length > 0 && (
            <p className="meta">
              <Icon name="user" size={16} />
              {course.trainers.map((t) => t.fullName).join(', ')}
            </p>
          )}
        </div>
        <div className="learn__progress" aria-live="polite">
          <ProgressBar progress={progress} />
          {progress.percent === 100 && progress.totalTopics > 0 && (
            <p className="learn__done">
              <Icon name="check" size={16} /> Well done — you have completed every topic.
            </p>
          )}
        </div>
      </header>

      {actionError && <Alert>{actionError}</Alert>}

      {course.modules.length === 0 ? (
        <div className="card">
          <p className="muted">The course content will appear here once it is published.</p>
        </div>
      ) : (
        <ol className="learn__modules">
          {course.modules.map((module, index) => {
            const done = module.topics.filter((t) => t.completed).length
            return (
              <li key={module.id} className="card learn__module">
                <div className="learn__module-head">
                  <div>
                    <span className="curriculum__number">Module {index + 1}</span>
                    <h2 className="learn__module-title">{module.title}</h2>
                    {module.description && <p className="curriculum__text">{module.description}</p>}
                  </div>
                  <span className="learn__module-count">
                    {done}/{module.topics.length}
                  </span>
                </div>
                {module.topics.length === 0 ? (
                  <p className="muted small">No topics in this module yet.</p>
                ) : (
                  <ul className="topics">
                    {module.topics.map((topic) => (
                      <TopicItem
                        key={topic.id}
                        topic={topic}
                        busy={busyTopicId === topic.id}
                        onComplete={completeTopic}
                      />
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
