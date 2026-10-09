import { useCallback, useState } from 'react'
import { coursesApi, studentApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { CourseStatusBadge, LevelBadge } from '../components/Badges'
import { CourseArt } from '../components/CourseArt'
import { CourseIcon } from '../components/CourseIcon'
import { Icon } from '../components/Icon'
import { Reveal } from '../components/Reveal'
import { Alert, ErrorState, LoadingState, Spinner } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import { loginPath } from '../router/match'
import { useRouter } from '../router/useRouter'
import { LEVEL_LABELS, splitLines } from '../utils/format'
import NotFoundPage from './NotFoundPage'

// Enrolment for a signed-in Student. Knows whether they are already enrolled
// from their own course list.
function StudentEnrolAction({ course }) {
  const { navigate } = useRouter()
  const mine = useResource(studentApi.courses)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const learnPath = `/my-courses/${course.id}`
  const enrolled = mine.data?.some((c) => c.id === course.id)

  const enrol = async () => {
    setBusy(true)
    setError(null)
    try {
      await coursesApi.enrol(course.id)
      navigate(learnPath)
    } catch (err) {
      // Already enrolled (e.g. in another tab): take them to the course.
      if (err.status === 409) navigate(learnPath)
      else {
        setError(err.message)
        setBusy(false)
      }
    }
  }

  if (mine.loading) return <LoadingState label="Checking your enrolment…" />
  if (enrolled)
    return (
      <>
        <p className="enrol__note">
          <Icon name="check" size={16} /> You are enrolled in this course.
        </p>
        <Link to={learnPath} className="btn btn--primary btn--block btn--lg">
          Continue learning <Icon name="arrowRight" />
        </Link>
      </>
    )

  return (
    <>
      {error && <Alert>{error}</Alert>}
      <button type="button" className="btn btn--primary btn--block btn--lg" onClick={enrol} disabled={busy}>
        {busy && <Spinner size="sm" />}
        Enrol now
      </button>
    </>
  )
}

function EnrolPanel({ course }) {
  const { status, isStudent } = useAuth()
  const { fullPath } = useRouter()

  let action
  if (status === 'checking') action = <LoadingState label="Checking your session…" />
  else if (status !== 'authenticated')
    action = (
      <>
        <Link to={loginPath(fullPath)} className="btn btn--primary btn--block btn--lg">
          Log in to enrol
        </Link>
        <p className="enrol__hint">
          New to Eduyarp?{' '}
          <Link to={`/register?next=${encodeURIComponent(fullPath)}`}>Create a free account</Link>
        </p>
      </>
    )
  else if (!isStudent)
    action = (
      <Alert tone="info">Enrolment is available to Student accounts only.</Alert>
    )
  else action = <StudentEnrolAction course={course} />

  return (
    <aside className="enrol card" aria-labelledby="enrol-title">
      <h2 id="enrol-title" className="visually-hidden">
        Enrolment
      </h2>
      <dl className="enrol__facts">
        <div>
          <dt>Level</dt>
          <dd>{LEVEL_LABELS[course.level]}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{course.duration || 'Flexible'}</dd>
        </div>
        <div>
          <dt>Content</dt>
          <dd>
            {course.modules.length} modules ·{' '}
            {course.modules.reduce((sum, m) => sum + m.topics.length, 0)} topics
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <CourseStatusBadge status={course.status} />
          </dd>
        </div>
      </dl>
      {action}
    </aside>
  )
}

export default function CourseDetailPage({ params }) {
  const loader = useCallback(() => coursesApi.get(params.slug), [params.slug])
  const { data: course, error, loading, reload } = useResource(loader)
  usePageTitle(course?.title ?? 'Course')

  if (loading) return <LoadingState label="Loading course…" />
  if (error?.status === 404) return <NotFoundPage message="This course is not available." />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const objectives = splitLines(course.learningObjectives)

  return (
    <>
      <section className="course-hero">
        <CourseArt course={course} className="course-art--hero" eager />
        <div className="container course-hero__inner">
          <Link to="/courses" className="back-link">
            <Icon name="arrowLeft" size={16} /> All courses
          </Link>
          <div className="course-hero__badges">
            <LevelBadge level={course.level} />
            <span className="meta meta--light">
              <Icon name="clock" size={16} />
              {course.duration || 'Flexible duration'}
            </span>
          </div>
          <div className="course-hero__head">
            <CourseIcon course={course} size="lg" />
            <h1 className="course-hero__title">{course.title}</h1>
          </div>
          {course.description && <p className="course-hero__text">{course.description}</p>}
          {course.trainers.length > 0 && (
            <p className="meta meta--light course-hero__trainers">
              <Icon name="user" size={16} />
              {course.trainers.length === 1 ? 'Trainer' : 'Trainers'}: {course.trainers.map((t) => t.fullName).join(', ')}
            </p>
          )}
          <ul className="course-hero__stats">
            <li>
              <Icon name="layers" size={16} /> {course.modules.length}{' '}
              {course.modules.length === 1 ? 'module' : 'modules'}
            </li>
            <li>
              <Icon name="book" size={16} /> {course.modules.reduce((sum, m) => sum + m.topics.length, 0)} topics
            </li>
            <li>
              <Icon name="level" size={16} /> {LEVEL_LABELS[course.level]}
            </li>
          </ul>
        </div>
      </section>

      <div className="container course-layout">
        <div className="course-main">
          {objectives.length > 0 && (
            <Reveal as="section" className="card" aria-labelledby="objectives-title">
              <h2 id="objectives-title" className="card__title">
                <Icon name="target" /> What you will learn
              </h2>
              <ul className="check-list">
                {objectives.map((objective) => (
                  <li key={objective}>
                    <Icon name="check" size={18} />
                    {objective}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          <Reveal as="section" className="card" aria-labelledby="curriculum-title">
            <h2 id="curriculum-title" className="card__title">
              <Icon name="book" /> Course content
            </h2>
            {course.modules.length === 0 ? (
              <p className="muted">The course outline will be published soon.</p>
            ) : (
              <ol className="curriculum">
                {course.modules.map((module, index) => (
                  <li key={module.id} className="curriculum__module">
                    <details className="acc" open={index === 0}>
                      <summary className="acc__summary">
                        <span className="curriculum__number">Module {index + 1}</span>
                        <h3 className="curriculum__title">{module.title}</h3>
                        <span className="acc__count">
                          {module.topics.length} {module.topics.length === 1 ? 'topic' : 'topics'}
                        </span>
                        <Icon name="chevronDown" size={18} className="acc__chev" />
                      </summary>
                      <div className="acc__panel">
                        {module.description && <p className="curriculum__text">{module.description}</p>}
                        {module.topics.length > 0 && (
                          <ul className="curriculum__topics">
                            {module.topics.map((topic) => (
                              <li key={topic.id}>{topic.title}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ol>
            )}
          </Reveal>

          <Reveal as="section" className="card" aria-labelledby="trainers-title">
            <h2 id="trainers-title" className="card__title">
              <Icon name="user" /> Trainers
            </h2>
            {course.trainers.length === 0 ? (
              <p className="muted">Trainer details will be announced soon.</p>
            ) : (
              <ul className="trainer-list">
                {course.trainers.map((trainer) => (
                  <li key={trainer.id} className="trainer">
                    <span className="avatar" aria-hidden="true">
                      {trainer.fullName.charAt(0).toUpperCase()}
                    </span>
                    <span className="trainer__name">{trainer.fullName}</span>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </div>

        <EnrolPanel course={course} />
      </div>
    </>
  )
}
