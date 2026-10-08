import { useState } from 'react'
import '../dashboard.css'
import { eduyarpApi, leadsApi, platformsApi, servicesApi, usersApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { CourseBars, StatusDonut, WeekColumns } from '../components/dashboard/Charts'
import { Kpi, Panel } from '../components/dashboard/Panel'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import {
  activeStudentCount,
  activityFeed,
  courseHealth,
  dayLabel,
  enrolmentStatusCounts,
  enrolmentsByCourse,
  formatClock,
  leadsByWeek,
  leadsInLastDays,
  relativeTime,
  upcomingClasses,
} from '../utils/dashboard'
import { formatDate, formatDateTime } from '../utils/format'
import { ROLE_LABELS } from '../utils/labels'

// Every figure on this page is derived from the lists the Admin API already returns
// (see utils/dashboard.js). Each card has its own data source, so one failed request only
// affects its own card.

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const countWhere = (list, predicate) => list.filter(predicate).length

function ActivityItem({ event, now }) {
  let text
  if (event.type === 'user') {
    text = (
      <>
        <strong>{event.who}</strong> registered <span className="muted">({ROLE_LABELS[event.role] ?? event.role})</span>
      </>
    )
  } else if (event.type === 'enrolment') {
    text = (
      <>
        <strong>{event.who}</strong> enrolled in {event.course}
        {event.status !== 'active' && <span className="muted"> ({event.status === 'completed' ? 'completed' : 'cancelled'})</span>}
      </>
    )
  } else if (event.type === 'lead') {
    text = (
      <>
        Fitness enquiry from <strong>{event.business}</strong>
      </>
    )
  } else {
    text = (
      <>
        Course <strong>{event.course}</strong> created <span className="muted">({event.status})</span>
      </>
    )
  }
  return (
    <li className="feed__item">
      <span className={`feed__dot feed__dot--${event.type}`} aria-hidden="true" />
      <p className="feed__text">{text}</p>
      <time className="feed__time" dateTime={new Date(event.at).toISOString()} title={formatDateTime(event.at)}>
        {relativeTime(event.at, now)}
      </time>
    </li>
  )
}

const SHORTCUTS = [
  { to: '/eduyarp/courses', label: 'Manage courses', icon: 'courses' },
  { to: '/users', label: 'Manage users', icon: 'users' },
  { to: '/eduyarp/classes', label: 'Schedule class', icon: 'classes' },
  { to: '/eduyarp/enrolments', label: 'View enrolments', icon: 'enrolments' },
  { to: '/fitness-leads', label: 'View Fitness leads', icon: 'leads' },
]

export default function OverviewPage() {
  const { user } = useAuth()
  // Fixed when the page opens, so "upcoming" and relative times are stable across re-renders.
  const [now] = useState(() => Date.now())
  const users = useResource(usersApi.list)
  const courses = useResource(eduyarpApi.courses.list)
  const enrolments = useResource(eduyarpApi.enrolments.list)
  const classes = useResource(eduyarpApi.classes.list)
  const leads = useResource(leadsApi.list)
  const platforms = useResource(platformsApi.list)
  const services = useResource(servicesApi.list)

  return (
    <>
      <PageHeader title="Dashboard" description={`Overview of your Eduyog platform activity. Signed in as ${user.fullName}.`} />

      <div className="kpis">
        <Kpi
          label="Total users"
          icon="users"
          to="/users"
          resource={users}
          value={(list) => list.length}
          detail={(list) =>
            list.length === 0
              ? 'No users yet'
              : `${countWhere(list, (u) => u.role === 'student')} students · ${countWhere(list, (u) => u.role === 'trainer')} trainers · ${countWhere(list, (u) => u.role === 'admin')} admin`
          }
        />
        <Kpi
          label="Active courses"
          icon="courses"
          to="/eduyarp/courses"
          resource={courses}
          value={(list) => countWhere(list, (c) => c.status === 'published')}
          detail={(list) => {
            const other = countWhere(list, (c) => c.status !== 'published')
            return list.length === 0 ? 'No courses yet' : other === 0 ? 'All courses published' : `${other} draft or archived`
          }}
        />
        <Kpi
          label="Active enrolments"
          icon="enrolments"
          to="/eduyarp/enrolments"
          resource={enrolments}
          value={(list) => countWhere(list, (e) => e.status === 'active')}
          detail={(list) => (list.length === 0 ? 'No enrolments yet' : `${plural(activeStudentCount(list), 'student')} learning now`)}
        />
        <Kpi
          label="Fitness leads"
          icon="leads"
          to="/fitness-leads"
          resource={leads}
          value={(list) => list.length}
          detail={(list) => (list.length === 0 ? 'No enquiries yet' : `${leadsInLastDays(list, 30, now)} in the last 30 days`)}
        />
      </div>

      <div className="board">
        <Panel
          className="board__status"
          title="Enrolment status"
          icon="enrolments"
          to="/eduyarp/enrolments"
          linkLabel="View enrolments"
          resources={[enrolments]}
          errorLabel="enrolment data"
          skeletonLines={4}
        >
          {() => {
            const counts = enrolmentStatusCounts(enrolments.data)
            return counts.total === 0 ? <p className="panel__empty">No enrolment activity yet.</p> : <StatusDonut counts={counts} />
          }}
        </Panel>

        <Panel
          className="board__courses"
          title="Students by course"
          icon="courses"
          to="/eduyarp/courses"
          linkLabel="Manage courses"
          resources={[enrolments]}
          errorLabel="enrolment data"
          skeletonLines={4}
        >
          {() => {
            const rows = enrolmentsByCourse(enrolments.data)
            return rows.length === 0 ? <p className="panel__empty">No students are enrolled in a course yet.</p> : <CourseBars rows={rows} />
          }}
        </Panel>

        <Panel
          className="board__activity"
          title="Recent activity"
          icon="activity"
          resources={[users, enrolments, leads, courses]}
          partial
          errorLabel="recent activity"
          skeletonLines={5}
        >
          {() => {
            const feed = activityFeed({ users: users.data ?? [], enrolments: enrolments.data ?? [], leads: leads.data ?? [], courses: courses.data ?? [] })
            return feed.length === 0 ? (
              <p className="panel__empty">No recent activity.</p>
            ) : (
              <ul className="feed">
                {feed.map((event) => (
                  <ActivityItem key={event.key} event={event} now={now} />
                ))}
              </ul>
            )
          }}
        </Panel>

        <Panel
          className="board__classes"
          title="Upcoming classes"
          icon="classes"
          to="/eduyarp/classes"
          linkLabel="View schedule"
          resources={[classes]}
          errorLabel="classes"
          skeletonLines={4}
        >
          {() => {
            const upcoming = upcomingClasses(classes.data, now, 5)
            return upcoming.length === 0 ? (
              <p className="panel__empty">No classes scheduled.</p>
            ) : (
              <ol className="schedule">
                {upcoming.map((c) => (
                  <li key={c.id} className="schedule__item">
                    <div className="schedule__when">
                      <span className="schedule__day">{dayLabel(c.scheduledAt, now)}</span>
                      <time className="schedule__time" dateTime={new Date(c.scheduledAt).toISOString()}>
                        {formatClock(c.scheduledAt)}
                      </time>
                    </div>
                    <div className="schedule__what">
                      <span className="schedule__course">{c.courseTitle}</span>
                      <span className="schedule__trainer">{c.trainerName}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )
          }}
        </Panel>

        <Panel
          className="board__health"
          title="Course health"
          icon="courses"
          to="/eduyarp/courses"
          linkLabel="Manage courses"
          resources={[courses, classes]}
          errorLabel="course data"
          skeletonLines={4}
        >
          {() => {
            const health = courseHealth(courses.data, classes.data, now)
            if (health.publishedTotal === 0) return <p className="panel__empty">No published courses yet.</p>
            const attention = health.noTrainer + health.noUpcoming
            return (
              <>
                <p className={`health__summary${attention === 0 ? ' health__summary--ok' : ''}`}>
                  <Icon name={attention === 0 ? 'activity' : 'alert'} size={16} />
                  {attention === 0
                    ? 'Every published course has a trainer and an upcoming class.'
                    : `${plural(health.noTrainer, 'published course')} without a trainer · ${plural(health.noUpcoming, 'course')} without an upcoming class`}
                </p>
                <ul className="health">
                  {health.items.map((c) => (
                    <li key={c.id} className="health__item">
                      <Link to={`/eduyarp/courses/${c.id}`} className="health__title">
                        {c.title}
                      </Link>
                      <span className="health__facts">
                        <span className="badge badge--success">Published</span>
                        <span className={c.trainers === 0 ? 'health__warn' : ''}>{c.trainers === 0 ? 'No trainer' : plural(c.trainers, 'trainer')}</span>
                        <span>{plural(c.students, 'student')}</span>
                        <span className={c.nextClass ? '' : 'health__warn'}>
                          {c.nextClass ? `Next class ${dayLabel(c.nextClass.scheduledAt, now).toLowerCase()}` : 'No upcoming class'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )
          }}
        </Panel>

        <Panel
          className="board__fitness"
          title="Fitness enquiries"
          icon="leads"
          to="/fitness-leads"
          linkLabel="View all leads"
          resources={[leads]}
          errorLabel="Fitness enquiries"
          skeletonLines={4}
        >
          {() => {
            const list = leads.data
            if (list.length === 0) return <p className="panel__empty">No enquiries yet.</p>
            return (
              <>
                <WeekColumns weeks={leadsByWeek(list, 8, now)} />
                <p className="fitness__recent-label">Most recent</p>
                <ul className="fitness__recent">
                  {list.slice(0, 3).map((l) => (
                    <li key={l.id}>
                      <span className="fitness__name">{l.businessName}</span>
                      <span className="fitness__date">{formatDate(l.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )
          }}
        </Panel>
      </div>

      <section className="shortcuts" aria-label="Shortcuts">
        <h2 className="shortcuts__title">Shortcuts</h2>
        <div className="shortcuts__list">
          {SHORTCUTS.map((s) => (
            <Link key={s.to} to={s.to} className="shortcut">
              <Icon name={s.icon} size={16} />
              {s.label}
            </Link>
          ))}
        </div>
        <p className="shortcuts__site">
          Website content:{' '}
          <Link to="/platforms">
            Platforms{platforms.data ? ` (${countWhere(platforms.data, (p) => p.isActive)} active)` : platforms.error ? ' (unavailable)' : ''}
          </Link>
          {' · '}
          <Link to="/services">
            Services{services.data ? ` (${countWhere(services.data, (s) => s.isActive)} active)` : services.error ? ' (unavailable)' : ''}
          </Link>
        </p>
      </section>
    </>
  )
}
