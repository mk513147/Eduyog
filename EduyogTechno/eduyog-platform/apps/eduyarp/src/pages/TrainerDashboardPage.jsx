import { trainerApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { ClassStatusBadge, CourseStatusBadge, LevelBadge } from '../components/Badges'
import { Icon } from '../components/Icon'
import { Alert, EmptyState, ErrorState, LoadingState } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import { formatDate, formatTime } from '../utils/format'

function Summary({ summary }) {
  const items = [
    { icon: 'book', value: summary.courseCount, label: summary.courseCount === 1 ? 'Assigned course' : 'Assigned courses' },
    { icon: 'users', value: summary.studentCount, label: summary.studentCount === 1 ? 'Current student' : 'Current students' },
    { icon: 'calendar', value: summary.upcomingClassCount, label: summary.upcomingClassCount === 1 ? 'Upcoming class' : 'Upcoming classes' },
  ]
  return (
    <ul className="t-summary" aria-label="Summary">
      {items.map((item) => (
        <li key={item.label} className="t-summary__item">
          <span className="t-summary__icon">
            <Icon name={item.icon} size={18} />
          </span>
          <span className="t-summary__value">{item.value}</span>
          <span className="t-summary__label">{item.label}</span>
        </li>
      ))}
    </ul>
  )
}

function CourseRows({ courses }) {
  return (
    <ul className="t-courses">
      {courses.map((course) => (
        <li key={course.id} className="t-course">
          <div className="t-course__main">
            <Link to={`/trainer/courses/${course.id}`} className="t-course__title">
              {course.title}
            </Link>
            <div className="t-course__badges">
              <CourseStatusBadge status={course.status} />
              <LevelBadge level={course.level} />
            </div>
          </div>
          <dl className="t-course__facts">
            <div>
              <dt>Students</dt>
              <dd>{course.studentCount}</dd>
            </div>
            <div>
              <dt>Next class</dt>
              <dd>
                {course.nextClass ? (
                  <>
                    {formatDate(course.nextClass.scheduledAt)}, {formatTime(course.nextClass.scheduledAt)}
                  </>
                ) : (
                  <span className="muted">None scheduled</span>
                )}
              </dd>
            </div>
          </dl>
          <Link to={`/trainer/courses/${course.id}`} className="btn btn--secondary btn--sm">
            Open course <Icon name="arrowRight" size={16} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Schedule({ resource }) {
  const { data: classes, error, loading, reload } = resource
  if (loading) return <LoadingState label="Loading classes…" />
  if (error && !classes) return <ErrorState error={error} onRetry={reload} />
  if (classes.length === 0) return <EmptyState title="No upcoming classes" description="Classes for your courses will appear here." />
  return (
    <ul className="t-classes">
      {classes.map((cls) => (
        <li key={cls.id} className="t-class">
          <div className="t-class__when">
            <span className="t-class__date">{formatDate(cls.scheduledAt)}</span>
            <span className="t-class__time">{formatTime(cls.scheduledAt)}</span>
          </div>
          <div className="t-class__what">
            <Link to={`/trainer/courses/${cls.courseId}`} className="t-class__course">
              {cls.courseTitle}
            </Link>
            <span className="t-class__title">{cls.title}</span>
          </div>
          <div className="t-class__actions">
            <ClassStatusBadge status={cls.status} />
            {cls.status === 'scheduled' && cls.meetingLink && (
              <a className="btn btn--secondary btn--sm" href={cls.meetingLink} target="_blank" rel="noopener noreferrer">
                <Icon name="video" size={16} />
                Meeting link
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function TrainerDashboardPage() {
  usePageTitle('Trainer dashboard')
  const { user } = useAuth()
  const courses = useResource(trainerApi.courses)
  const schedule = useResource(trainerApi.schedule)

  let body
  if (courses.loading) body = <LoadingState label="Loading your courses…" />
  else if (courses.error && !courses.data) body = <ErrorState error={courses.error} onRetry={courses.reload} />
  else if (courses.data.courses.length === 0)
    body = (
      <EmptyState
        title="You are not assigned to any courses yet"
        description="An Admin assigns Trainers to courses. Once you are assigned, your courses and students appear here."
      />
    )
  else
    body = (
      <>
        <Summary summary={courses.data.summary} />
        <div className="t-layout">
          <section aria-labelledby="t-courses-title">
            <h2 id="t-courses-title" className="section__title section__title--sm">
              Your courses
            </h2>
            <CourseRows courses={courses.data.courses} />
          </section>
          <section className="card" aria-labelledby="t-classes-title">
            <h2 id="t-classes-title" className="card__title">
              <Icon name="calendar" /> Upcoming classes
            </h2>
            <Schedule resource={schedule} />
          </section>
        </div>
      </>
    )

  return (
    <div className="container page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Trainer dashboard</p>
          <h1 className="page__title">Welcome, {user.fullName.split(' ')[0]}</h1>
          <p className="muted">Your assigned courses, current students and classes.</p>
        </div>
      </header>
      {courses.error && courses.data && <Alert>Could not refresh your courses: {courses.error.message}</Alert>}
      {body}
    </div>
  )
}
