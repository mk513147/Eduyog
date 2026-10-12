import { useCallback } from 'react'
import { studentApi } from '../api/endpoints'
import { LevelBadge } from '../components/Badges'
import { ContactAccess } from '../components/ContactAccess'
import { CourseArt } from '../components/CourseArt'
import { CourseIcon } from '../components/CourseIcon'
import { Icon } from '../components/Icon'
import { LearnWorkspace } from '../components/learn/LearnWorkspace'
import { ErrorState, LoadingState } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import NotFoundPage from './NotFoundPage'

// The demo: the first two topics of the first module, available to any signed-in student without
// enrolment. Everything else arrives from the backend already locked (title only), so nothing
// here decides what is unlocked and no progress is recorded.
export default function PreviewPage({ params }) {
  const loader = useCallback(() => studentApi.demoCourse(params.courseId), [params.courseId])
  const { data: course, error, loading, reload } = useResource(loader)
  usePageTitle(course ? `Preview: ${course.title}` : 'Course preview')

  if (loading) return <LoadingState label="Loading the preview…" />
  if (error?.status === 404 || error?.status === 400) return <NotFoundPage message="This course is not available." />
  if (error) return <ErrorState error={error} onRetry={reload} />

  return (
    <div className="learn">
      <div className="container">
        <header className="learn-head">
          <CourseArt course={course} className="course-art--head" eager />
          <nav className="learn-head__links" aria-label="Course navigation links">
            <Link to={`/eduyarp/courses/${course.slug}`} className="learn-head__link">
              <Icon name="arrowLeft" size={16} /> Course details
            </Link>
          </nav>
          <div className="learn-head__row">
            <CourseIcon course={course} />
            <div className="learn-head__titles">
              <div className="my-course__badges">
                <LevelBadge level={course.level} />
                <span className="badge">Preview</span>
              </div>
              <h1 className="learn-head__title">{course.title}</h1>
            </div>
          </div>
        </header>

        {course.hasFullAccess ? (
          <div className="completion" role="status">
            <Icon name="check" size={28} />
            <div className="completion__text">
              <strong>You have full access to this course</strong>
              <span>This is the preview. Continue where you left off in your course.</span>
            </div>
            <Link to={`/eduyarp/my-courses/${course.id}`} className="btn btn--primary btn--sm">
              Continue learning
            </Link>
          </div>
        ) : (
          <ContactAccess courseTitle={course.title} heading="You are viewing the free preview" bar />
        )}

        <LearnWorkspace course={course} />
      </div>
    </div>
  )
}
