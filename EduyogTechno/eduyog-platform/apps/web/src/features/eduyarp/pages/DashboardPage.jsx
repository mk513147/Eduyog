import { useCallback } from 'react'
import { studentApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { ClassStatusBadge, EnrolmentStatusBadge, LevelBadge } from '../components/Badges'
import { CourseIcon } from '../components/CourseIcon'
import { Icon } from '../components/Icon'
import { ProgressRing } from '../components/ProgressRing'
import { ProgressBar } from '../components/ProgressBar'
import { Reveal } from '../components/Reveal'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import { formatDate, formatTime } from '../utils/format'

// The course to put first: an unfinished one with the most progress, otherwise the first course.
function pickCurrent(courses) {
  const open = courses.filter((c) => c.enrolment.status !== 'completed')
  if (open.length === 0) return courses[0]
  return open.reduce((best, c) => (c.enrolment.progress.percent > best.enrolment.progress.percent ? c : best))
}

function ContinueCard({ course }) {
  const { progress } = course.enrolment
  const started = progress.completedTopics > 0
  const finished = course.enrolment.status === 'completed'
  return (
    <section className="continue" aria-labelledby="continue-title">
      <div className="continue__main">
        <p className="eyebrow">{finished ? 'Course completed' : started ? 'Continue where you left off' : 'Start your course'}</p>
        <div className="continue__head">
          <CourseIcon course={course} />
          <div>
            <h2 id="continue-title" className="continue__title">
              {course.title}
            </h2>
            <div className="my-course__badges">
              <LevelBadge level={course.level} />
              <EnrolmentStatusBadge status={course.enrolment.status} />
            </div>
          </div>
        </div>
        {course.description && <p className="continue__text line-clamp-2">{course.description}</p>}
        <div className="continue__actions">
          <Link to={`/eduyarp/my-courses/${course.id}`} className="btn btn--primary btn--lg">
            {finished ? 'Review course' : started ? 'Continue learning' : 'Start learning'}
            <Icon name="arrowRight" />
          </Link>
          {finished && (
            <Link to="/eduyarp/certificates" className="btn btn--secondary btn--lg">
              Certificates
            </Link>
          )}
        </div>
      </div>
      <div className="continue__progress" aria-label="Course progress">
        <ProgressRing percent={progress.percent} />
        <p className="continue__count">
          <strong>{progress.completedTopics}</strong> of {progress.totalTopics} topics completed
        </p>
      </div>
    </section>
  )
}

function OtherCourses({ courses }) {
  if (courses.length === 0) return null
  return (
    <section aria-labelledby="other-courses-title" className="other-courses">
      <h2 id="other-courses-title" className="dash-heading">
        Your other courses
      </h2>
      <ul className="other-courses__list">
        {courses.map((course) => (
          <li key={course.id} className="other-course">
            <CourseIcon course={course} size="md" />
            <div className="other-course__body">
              <Link to={`/eduyarp/my-courses/${course.id}`} className="other-course__title">
                {course.title}
              </Link>
              <ProgressBar progress={course.enrolment.progress} size="sm" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function NoCourse() {
  return (
    <section className="continue continue--empty" aria-labelledby="no-course-title">
      <div className="continue__main">
        <p className="eyebrow">Get started</p>
        <h2 id="no-course-title" className="continue__title">
          You do not have a course yet
        </h2>
        <p className="continue__text">Preview any course for free, then contact Eduyog to get full access.</p>
        <div className="continue__actions">
          <Link to="/eduyarp/courses" className="btn btn--primary btn--lg">
            Browse courses <Icon name="arrowRight" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function UpcomingClasses() {
  const { data: classes, error, loading, reload } = useResource(studentApi.schedule)

  if (loading) return <LoadingState label="Loading your schedule…" />
  if (error && !classes) return <ErrorState error={error} onRetry={reload} />
  if (classes.length === 0)
    return <EmptyState title="No upcoming classes" description="Live classes for your courses will appear here once they are scheduled." />

  return (
    <ul className="classes classes--compact">
      {classes.slice(0, 3).map((cls) => (
        <li key={cls.id} className={`class-item${cls.status === 'cancelled' ? ' class-item--cancelled' : ''}`}>
          <div className="class-item__when">
            <span className="class-item__date">{formatDate(cls.scheduledAt)}</span>
            <span className="class-item__time">{formatTime(cls.scheduledAt)}</span>
          </div>
          <div className="class-item__body">
            <p className="class-item__course">{cls.courseTitle}</p>
            <h3 className="class-item__title">{cls.title}</h3>
            <p className="meta">
              <Icon name="user" size={16} />
              {cls.trainerName}
            </p>
          </div>
          <div className="class-item__actions">
            <ClassStatusBadge status={cls.status} />
            {cls.meetingLink && cls.status === 'scheduled' ? (
              <a className="btn btn--primary btn--sm" href={cls.meetingLink} target="_blank" rel="noopener noreferrer">
                <Icon name="video" size={16} />
                Join class
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            ) : (
              cls.status === 'scheduled' && <span className="muted small">Link coming soon</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

// Open (published, not yet submitted) assignments of the current course, soonest due first.
function DueAssignments({ courseId }) {
  const loader = useCallback(() => studentApi.assignments(courseId), [courseId])
  const { data, error, loading, reload } = useResource(loader)

  if (loading) return <LoadingState label="Loading assignments…" />
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  const open = data
    .filter((a) => a.status === 'published' && !a.latestSubmission)
    .sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'))
    .slice(0, 3)
  if (open.length === 0) return <p className="muted small">Nothing to hand in right now.</p>
  return (
    <ul className="due-list">
      {open.map((a) => (
        <li key={a.id}>
          <Link to={`/eduyarp/my-courses/${courseId}/assignments/${a.id}`} className="due-list__title">
            {a.title}
          </Link>
          <span className="due-list__when">{a.dueAt ? `Due ${formatDate(a.dueAt)}` : 'No due date'}</span>
        </li>
      ))}
    </ul>
  )
}

export default function DashboardPage() {
  usePageTitle('My dashboard')
  const { user } = useAuth()
  const coursesResource = useResource(studentApi.courses)
  const { data: myCourses, error, loading, reload } = coursesResource
  const current = myCourses && myCourses.length > 0 ? pickCurrent(myCourses) : null
  const others = current ? myCourses.filter((c) => c.id !== current.id) : []
  const finished = myCourses?.filter((c) => c.enrolment.status === 'completed').length ?? 0

  let main
  if (loading) main = <LoadingState label="Loading your courses…" />
  else if (error && !myCourses) main = <ErrorState error={error} onRetry={reload} />
  else if (!current) main = <NoCourse />
  else
    main = (
      <>
        <ContinueCard course={current} />
        <OtherCourses courses={others} />
      </>
    )

  return (
    <div className="container page dash">
      <Reveal as="header" className="dash__head">
        <div>
          <p className="eyebrow">Student dashboard</p>
          <h1 className="dash__title">Welcome back, {user.fullName.split(' ')[0]}</h1>
        </div>
        {myCourses && (
          <p className="dash__summary">
            {myCourses.length} {myCourses.length === 1 ? 'course' : 'courses'} · {finished} completed
          </p>
        )}
      </Reveal>

      <div className="dash__grid">
        <div className="dash__main">{main}</div>

        <aside className="dash__side" aria-label="Schedule and assignments">
          <section className="side-card" aria-labelledby="classes-title">
            <h2 id="classes-title" className="dash-heading">
              <Icon name="calendar" size={16} /> Upcoming classes
            </h2>
            <UpcomingClasses />
          </section>

          {current && (
            <section className="side-card" aria-labelledby="due-title">
              <h2 id="due-title" className="dash-heading">
                <Icon name="edit" size={16} /> Assignments to hand in
              </h2>
              <DueAssignments courseId={current.id} />
            </section>
          )}

          <section className="side-card side-card--plain" aria-labelledby="account-title">
            <h2 id="account-title" className="dash-heading">
              <Icon name="user" size={16} /> Account
            </h2>
            <p className="side-card__name">{user.fullName}</p>
            <p className="side-card__email break">{user.email}</p>
            <div className="side-card__links">
              <Link to="/account/profile" className="text-link">
                Profile
              </Link>
              <Link to="/eduyarp/certificates" className="text-link">
                Certificates
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
