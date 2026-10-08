import { useCallback } from 'react'
import { trainerApi } from '../api/endpoints'
import { ClassStatusBadge, CourseStatusBadge, EnrolmentStatusBadge, LevelBadge } from '../components/Badges'
import { Icon } from '../components/Icon'
import { TrainerAssignments } from '../components/TrainerAssignments'
import { TrainerAnnouncements } from '../components/TrainerAnnouncements'
import { TrainerResources } from '../components/TrainerResources'
import { ProgressBar } from '../components/ProgressBar'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import { formatDate, formatShortDate, formatTime } from '../utils/format'
import NotFoundPage from './NotFoundPage'

function Students({ courseId, resource }) {
  const { data: students, error, loading, reload } = resource
  if (loading) return <LoadingState label="Loading students…" />
  if (error && !students) return <ErrorState error={error} onRetry={reload} />
  if (students.length === 0)
    return <EmptyState title="No current students" description="Students who enrol in this course appear here." />
  return (
    <ul className="t-students">
      {students.map((student) => (
        <li key={student.id} className="t-student">
          <div className="t-student__who">
            <Link to={`/trainer/courses/${courseId}/students/${student.id}`} className="t-student__name">
              {student.fullName}
            </Link>
            <span className="t-student__email break">{student.email}</span>
          </div>
          <div className="t-student__status">
            <EnrolmentStatusBadge status={student.enrolmentStatus} />
            <span className="muted small">
              {student.lastActivityAt ? `Last activity ${formatShortDate(student.lastActivityAt)}` : 'No activity yet'}
            </span>
          </div>
          <div className="t-student__progress">
            <ProgressBar progress={student.progress} size="sm" label="Progress" />
          </div>
          <Link to={`/trainer/courses/${courseId}/students/${student.id}`} className="btn btn--secondary btn--sm">
            View progress
            <span className="visually-hidden"> for {student.fullName}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function TrainerCoursePage({ params }) {
  const courseLoader = useCallback(() => trainerApi.course(params.courseId), [params.courseId])
  const studentsLoader = useCallback(() => trainerApi.students(params.courseId), [params.courseId])
  const course = useResource(courseLoader)
  const students = useResource(studentsLoader)
  usePageTitle(course.data?.title ?? 'Course')

  if (course.loading) return <LoadingState label="Loading course…" />
  if (course.error?.status === 403 || course.error?.status === 404 || course.error?.status === 400)
    return <NotFoundPage message="You are not assigned to this course." />
  if (course.error && !course.data) return <ErrorState error={course.error} onRetry={course.reload} />

  const c = course.data
  return (
    <div className="container page">
      <Link to="/trainer" className="back-link back-link--dark">
        <Icon name="arrowLeft" size={16} /> Trainer dashboard
      </Link>

      <header className="t-head card">
        <div className="my-course__badges">
          <CourseStatusBadge status={c.status} />
          <LevelBadge level={c.level} />
        </div>
        <h1 className="page__title">{c.title}</h1>
        {c.description && <p className="t-head__text">{c.description}</p>}
        <p className="meta">
          <Icon name="check" size={16} /> You are assigned to this course.
          <span aria-hidden="true"> · </span>
          {c.enrolmentCount} current {c.enrolmentCount === 1 ? 'student' : 'students'}
        </p>
      </header>

      <div className="t-grid">
        <section className="card" aria-labelledby="t-students-title">
          <h2 id="t-students-title" className="card__title">
            <Icon name="users" /> Students
          </h2>
          <Students courseId={params.courseId} resource={students} />
        </section>

        <section className="card" aria-labelledby="t-classes-title">
          <h2 id="t-classes-title" className="card__title">
            <Icon name="calendar" /> Classes
          </h2>
          {c.classes.length === 0 ? (
            <p className="muted">No classes scheduled for this course.</p>
          ) : (
            <ul className="t-classes">
              {c.classes.map((cls) => (
                <li key={cls.id} className="t-class">
                  <div className="t-class__when">
                    <span className="t-class__date">{formatDate(cls.scheduledAt)}</span>
                    <span className="t-class__time">{formatTime(cls.scheduledAt)}</span>
                  </div>
                  <div className="t-class__what">
                    <span className="t-class__course">{cls.title}</span>
                    <span className="t-class__title">{cls.trainerName}</span>
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
          )}
        </section>

        <TrainerAssignments courseId={params.courseId} courseTitle={c.title} modules={c.modules} />

        <TrainerResources courseId={params.courseId} courseTitle={c.title} modules={c.modules} />

        <TrainerAnnouncements courseId={params.courseId} />

        <section className="card t-grid__wide" aria-labelledby="t-outline-title">
          <h2 id="t-outline-title" className="card__title">
            <Icon name="layers" /> Curriculum
          </h2>
          <p className="muted small profile-note">Read only. An Admin manages modules and topics.</p>
          {c.modules.length === 0 ? (
            <p className="muted">This course has no modules yet.</p>
          ) : (
            <ol className="t-outline">
              {c.modules.map((module, index) => (
                <li key={module.id} className="t-outline__module">
                  <details open={index === 0}>
                    <summary className="t-outline__summary">
                      <span className="curriculum__number">Module {index + 1}</span>
                      <span className="t-outline__title">{module.title}</span>
                      <span className="muted small">
                        {module.topics.length} {module.topics.length === 1 ? 'topic' : 'topics'}
                      </span>
                      <Icon name="chevronDown" size={18} className="acc__chev" />
                    </summary>
                    {module.description && <p className="curriculum__text">{module.description}</p>}
                    <ul className="t-outline__topics">
                      {module.topics.map((topic) => (
                        <li key={topic.id}>
                          {topic.title}
                          {topic.videoUrl && <span className="t-outline__tag">Video</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
