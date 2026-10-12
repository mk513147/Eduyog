// Pure helpers that turn the lists the Admin API already returns into dashboard figures.
// Nothing here is hard-coded: every value is derived from the data passed in.

const DAY = 24 * 60 * 60 * 1000
const startOfDay = (value) => {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

export function enrolmentStatusCounts(enrolments) {
  const counts = { active: 0, completed: 0, cancelled: 0 }
  for (const e of enrolments) if (e.status in counts) counts[e.status] += 1
  return { ...counts, total: enrolments.length }
}

// Students with at least one active enrolment.
export function activeStudentCount(enrolments) {
  return new Set(enrolments.filter((e) => e.status === 'active').map((e) => e.student.id)).size
}

// Current participation per course: active + completed enrolments (cancelled ones are history).
// Most-enrolled first, ties by title.
export function enrolmentsByCourse(enrolments, limit = 6) {
  const byCourse = new Map()
  for (const e of enrolments) {
    if (e.status === 'cancelled') continue
    const row = byCourse.get(e.course.id) ?? { courseId: e.course.id, title: e.course.title, active: 0, completed: 0 }
    row[e.status] += 1
    byCourse.set(e.course.id, row)
  }
  return [...byCourse.values()]
    .map((row) => ({ ...row, total: row.active + row.completed }))
    .sort((a, b) => b.total - a.total || a.title.localeCompare(b.title))
    .slice(0, limit)
}

export function leadsInLastDays(leads, days, now) {
  const since = now - days * DAY
  return leads.filter((l) => new Date(l.createdAt).getTime() >= since).length
}

// Enquiries per calendar week (weeks start on Monday), oldest first, ending with the current week.
export function leadsByWeek(leads, weeks, now) {
  const monday = startOfDay(now)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(monday)
    start.setDate(start.getDate() - (weeks - 1 - i) * 7)
    return { start, count: 0 }
  })
  for (const l of leads) {
    const t = new Date(l.createdAt).getTime()
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (t >= buckets[i].start.getTime()) {
        buckets[i].count += 1
        break
      }
    }
  }
  return buckets
}

export function upcomingClasses(classes, now, limit = 5) {
  return classes
    .filter((c) => c.status === 'scheduled' && new Date(c.scheduledAt).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .slice(0, limit)
}

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const shortDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const timeOfDay = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })

export const formatClock = (value) => timeOfDay.format(new Date(value))

// "Today", "Tomorrow", a weekday within the coming week, otherwise a short date.
export function dayLabel(value, now) {
  const days = Math.round((startOfDay(value) - startOfDay(now)) / DAY)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days > 1 && days < 7) return weekday.format(new Date(value))
  return shortDate.format(new Date(value))
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function relativeTime(value, now) {
  const seconds = Math.round((new Date(value).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return 'just now'
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 30) return relative.format(Math.round(seconds / 86400), 'day')
  return relative.format(Math.round(seconds / (86400 * 30)), 'month')
}

// Published courses that need attention (no trainer / no upcoming class), plus the few notable ones to show.
export function courseHealth(courses, classes, now, limit = 4) {
  const next = new Map()
  for (const c of upcomingClasses(classes, now, Infinity)) if (!next.has(c.courseId)) next.set(c.courseId, c)
  const published = courses
    .filter((c) => c.status === 'published')
    .map((c) => ({
      id: c.id,
      title: c.title,
      trainers: c.trainers.length,
      students: c.enrolmentCount,
      nextClass: next.get(c.id) ?? null,
    }))
  const noTrainer = published.filter((c) => c.trainers === 0).length
  const noUpcoming = published.filter((c) => !c.nextClass).length
  // Courses needing attention first, then the most-enrolled.
  const score = (c) => (c.trainers === 0 ? 2 : 0) + (c.nextClass ? 0 : 1)
  const items = [...published].sort((a, b) => score(b) - score(a) || b.students - a.students || a.title.localeCompare(b.title)).slice(0, limit)
  return { items, noTrainer, noUpcoming, publishedTotal: published.length }
}

// One chronological feed from the timestamps the data really has: registrations, enrolments,
// Fitness enquiries and newly created courses. Newest first.
export function activityFeed({ users = [], enrolments = [], leads = [], courses = [] }, limit = 8) {
  const events = [
    ...users.map((u) => ({ key: `u${u.id}`, type: 'user', at: u.createdAt, who: u.fullName, role: u.role })),
    ...enrolments.map((e) => ({ key: `e${e.id}`, type: 'enrolment', at: e.enrolledAt, who: e.student.fullName, course: e.course.title, status: e.status })),
    ...leads.map((l) => ({ key: `l${l.id}`, type: 'lead', at: l.createdAt, business: l.businessName })),
    ...courses.map((c) => ({ key: `c${c.id}`, type: 'course', at: c.createdAt, course: c.title, status: c.status })),
  ]
  return events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit)
}
