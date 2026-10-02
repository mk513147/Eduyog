import { studentApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { ClassStatusBadge, CourseStatusBadge, EnrolmentStatusBadge, LevelBadge } from '../components/Badges'
import { Icon } from '../components/Icon'
import { ProgressBar } from '../components/ProgressBar'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import { formatDate, formatTime } from '../utils/format'

function MyCourses() {
  const { data: courses, error, loading, reload } = useResource(studentApi.courses)

  if (loading) return <LoadingState label="Loading your courses…" />
  if (error && !courses) return <ErrorState error={error} onRetry={reload} />
  if (courses.length === 0)
    return (
      <EmptyState
        title="You have not enrolled in a course yet"
        description="Browse the catalogue and enrol to start learning."
        action={
          <Link to="/courses" className="btn btn--primary">
            Browse courses
          </Link>
        }
      />
    )

  return (
    <ul className="my-courses">
      {courses.map((course) => (
        <li key={course.id} className="my-course card">
          <div className="my-course__badges">
            <LevelBadge level={course.level} />
            <EnrolmentStatusBadge status={course.enrolment.status} />
            {course.status !== 'published' && <CourseStatusBadge status={course.status} />}
          </div>
          <h3 className="my-course__title">{course.title}</h3>
          <ProgressBar progress={course.enrolment.progress} size="sm" />
          <Link to={`/my-courses/${course.id}`} className="btn btn--secondary btn--block">
            {course.enrolment.progress.completedTopics === 0 ? 'Start course' : 'Continue'}
            <Icon name="arrowRight" size={16} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function UpcomingClasses() {
  const { data: classes, error, loading, reload } = useResource(studentApi.schedule)

  if (loading) return <LoadingState label="Loading your schedule…" />
  if (error && !classes) return <ErrorState error={error} onRetry={reload} />
  if (classes.length === 0)
    return (
      <EmptyState
        title="No upcoming classes"
        description="Live classes for your courses will appear here once they are scheduled."
      />
    )

  return (
    <ul className="classes">
      {classes.map((cls) => (
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

export default function DashboardPage() {
  usePageTitle('My dashboard')
  const { user } = useAuth()

  return (
    <div className="container page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Student dashboard</p>
          <h1 className="page__title">Welcome, {user.fullName.split(' ')[0]}</h1>
        </div>
      </header>

      <div className="dashboard">
        <section className="card profile" aria-labelledby="profile-title">
          <h2 id="profile-title" className="card__title">
            <Icon name="user" /> Profile
          </h2>
          <dl className="profile__details">
            <div>
              <dt>Name</dt>
              <dd>{user.fullName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd className="break">{user.email}</dd>
            </div>
          </dl>
        </section>

        <section className="dashboard__courses" aria-labelledby="my-courses-title">
          <div className="section__header">
            <h2 id="my-courses-title" className="section__title section__title--sm">
              My courses
            </h2>
            <Link to="/courses" className="text-link">
              Browse more courses
            </Link>
          </div>
          <MyCourses />
        </section>

        <section className="card dashboard__classes" aria-labelledby="classes-title">
          <h2 id="classes-title" className="card__title">
            <Icon name="calendar" /> Upcoming classes
          </h2>
          <UpcomingClasses />
        </section>
      </div>
    </div>
  )
}
