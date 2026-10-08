import { useCallback, useState } from 'react'
import { studentApi } from '../api/endpoints'
import { EnrolmentStatusBadge, LevelBadge } from '../components/Badges'
import { CourseArt } from '../components/CourseArt'
import { CourseIcon } from '../components/CourseIcon'
import { Icon } from '../components/Icon'
import { CourseExtras } from '../components/learn/CourseExtras'
import { LearnWorkspace } from '../components/learn/LearnWorkspace'
import { ProgressBar } from '../components/ProgressBar'
import { Alert, ErrorState, LoadingState } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import NotFoundPage from './NotFoundPage'

export default function LearnPage({ params }) {
  const loader = useCallback(() => studentApi.course(params.courseId), [params.courseId])
  const { data: course, error, loading, reload, setData } = useResource(loader)
  usePageTitle(course?.title ?? 'My course')
  const [busyTopicId, setBusyTopicId] = useState(null)
  const [actionError, setActionError] = useState(null)

  // The API returns the recalculated progress; apply it without a reload. Resolves to true when
  // the completion was saved. Topics are only ever completed by this explicit action.
  const completeTopic = async (topic) => {
    setBusyTopicId(topic.id)
    setActionError(null)
    try {
      const result = await studentApi.completeTopic(topic.id)
      setData((prev) => ({
        ...prev,
        enrolment: { ...prev.enrolment, status: result.enrolmentStatus, progress: result.progress },
        certificate: result.certificate ?? prev.certificate,
        modules: prev.modules.map((module) => ({
          ...module,
          topics: module.topics.map((t) =>
            t.id === topic.id ? { ...t, completed: true, completedAt: result.completedAt } : t,
          ),
        })),
      }))
      return true
    } catch (err) {
      setActionError(`Could not save your progress: ${err.message}`)
      return false
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
    <div className="learn">
      <div className="container">
        <header className="learn-head">
          <CourseArt course={course} className="course-art--head" eager />
          <nav className="learn-head__links" aria-label="Course navigation links">
            <Link to="/dashboard" className="learn-head__link">
              <Icon name="arrowLeft" size={16} /> My dashboard
            </Link>
            <Link to={`/courses/${course.slug}`} className="learn-head__link learn-head__link--quiet">
              Course details
            </Link>
          </nav>
          <div className="learn-head__row">
            <CourseIcon course={course} />
            <div className="learn-head__titles">
              <div className="my-course__badges">
                <LevelBadge level={course.level} />
                <EnrolmentStatusBadge status={course.enrolment.status} />
              </div>
              <h1 className="learn-head__title">{course.title}</h1>
              {course.trainers.length > 0 && (
                <p className="meta meta--light">
                  <Icon name="user" size={15} />
                  {course.trainers.map((t) => t.fullName).join(', ')}
                </p>
              )}
            </div>
            <div className="learn-head__progress">
              <ProgressBar progress={progress} size="sm" />
            </div>
          </div>
        </header>

        {actionError && <Alert>{actionError}</Alert>}

        {course.enrolment.status === 'completed' && (
          <div className="completion" role="status">
            <Icon name="award" size={28} />
            <div className="completion__text">
              <strong>Course completed</strong>
              {course.certificate ? (
                <span>
                  {course.certificate.status === 'revoked' ? 'Your certificate has been revoked.' : 'Certificate issued.'}
                </span>
              ) : (
                <span>You have finished every topic.</span>
              )}
            </div>
            {course.certificate && (
              <Link to={`/certificates/${course.certificate.id}`} className="btn btn--primary btn--sm">
                View certificate
              </Link>
            )}
          </div>
        )}

        <LearnWorkspace course={course} busyTopicId={busyTopicId} onComplete={completeTopic} />

        <CourseExtras courseId={course.id} />
      </div>
    </div>
  )
}
