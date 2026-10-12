// Small dependency-free charts (inline SVG / CSS). Each has a text summary or legend, so nothing
// depends on colour alone, and native tooltips (<title> / title) with the exact values.

const SEGMENTS = [
  { key: 'active', label: 'Active', className: 'seg--active' },
  { key: 'completed', label: 'Completed', className: 'seg--completed' },
  { key: 'cancelled', label: 'Cancelled', className: 'seg--cancelled' },
]

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// Part-to-whole: enrolment status. counts = { active, completed, cancelled, total }.
export function StatusDonut({ counts }) {
  // Where each segment starts, as a count of enrolments before it.
  const before = SEGMENTS.map((_, i) => SEGMENTS.slice(0, i).reduce((sum, t) => sum + counts[t.key], 0))
  const percent = (n) => (counts.total === 0 ? 0 : Math.round((n / counts.total) * 100))
  const summary = SEGMENTS.map((s) => `${counts[s.key]} ${s.label.toLowerCase()}`).join(', ')
  return (
    <div className="donut">
      <figure className="donut__figure" aria-label={`Enrolments by status: ${summary}`}>
        <svg viewBox="0 0 140 140" className="donut__svg" aria-hidden="true">
          <circle cx="70" cy="70" r={RADIUS} className="donut__track" />
          {SEGMENTS.map((s, i) => {
            const n = counts[s.key]
            if (n === 0) return null
            const length = (n / counts.total) * CIRCUMFERENCE
            const offset = (before[i] / counts.total) * CIRCUMFERENCE
            return (
              <circle
                key={s.key}
                cx="70"
                cy="70"
                r={RADIUS}
                className={`donut__seg ${s.className}`}
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={-offset}
              >
                <title>{`${s.label}: ${n} of ${counts.total} (${percent(n)}%)`}</title>
              </circle>
            )
          })}
        </svg>
        <figcaption className="donut__center">
          <span className="donut__total">{counts.total}</span>
          <span className="donut__caption">{counts.total === 1 ? 'enrolment' : 'enrolments'}</span>
        </figcaption>
      </figure>
      <ul className="legend">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="legend__row" title={`${s.label}: ${counts[s.key]} of ${counts.total} (${percent(counts[s.key])}%)`}>
            <span className={`legend__swatch ${s.className}`} aria-hidden="true" />
            <span className="legend__label">{s.label}</span>
            <span className="legend__value">{counts[s.key]}</span>
            <span className="legend__percent">{percent(counts[s.key])}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Horizontal stacked bars: current students per course (active + completed).
export function CourseBars({ rows }) {
  const max = Math.max(...rows.map((r) => r.total), 1)
  return (
    <div className="bars">
      <ul className="bars__list">
        {rows.map((r) => (
          <li
            key={r.courseId}
            className="bars__row"
            title={`${r.title}: ${r.total} ${r.total === 1 ? 'student' : 'students'} (${r.active} active, ${r.completed} completed)`}
          >
            <span className="bars__label">{r.title}</span>
            <span className="bars__track" aria-hidden="true">
              <span className="bars__fill seg--active" style={{ width: `${(r.active / max) * 100}%` }} />
              <span className="bars__fill seg--completed" style={{ width: `${(r.completed / max) * 100}%` }} />
            </span>
            <span className="bars__value">{r.total}</span>
          </li>
        ))}
      </ul>
      <p className="bars__legend">
        <span className="legend__swatch seg--active" aria-hidden="true" /> Active
        <span className="legend__swatch seg--completed" aria-hidden="true" /> Completed
        <span className="bars__note">Cancelled enrolments are not counted.</span>
      </p>
    </div>
  )
}

const weekFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

// Small column chart: enquiries per week.
export function WeekColumns({ weeks }) {
  const max = Math.max(...weeks.map((w) => w.count), 1)
  const total = weeks.reduce((sum, w) => sum + w.count, 0)
  return (
    <figure className="weeks" aria-label={`Enquiries per week over the last ${weeks.length} weeks: ${weeks.map((w) => w.count).join(', ')} (oldest to newest)`}>
      <div className="weeks__cols" aria-hidden="true">
        {weeks.map((w) => (
          <span
            key={w.start.toISOString()}
            className="weeks__col"
            title={`Week of ${weekFormat.format(w.start)}: ${w.count} ${w.count === 1 ? 'enquiry' : 'enquiries'}`}
          >
            <span className="weeks__bar" style={{ height: `${w.count === 0 ? 3 : 8 + (w.count / max) * 92}%` }} />
          </span>
        ))}
      </div>
      <figcaption className="weeks__caption">
        {total} in the last {weeks.length} weeks
      </figcaption>
    </figure>
  )
}
