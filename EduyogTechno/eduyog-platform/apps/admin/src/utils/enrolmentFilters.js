export const EMPTY_FILTERS = { search: '', status: '', courseId: '' }

export function hasActiveFilters(filters) {
  return filters.search.trim() !== '' || filters.status !== '' || filters.courseId !== ''
}

// Pure and client-side for now; the same filters object could later become
// query parameters for a server-side search.
export function filterEnrolments(enrolments, { search, status, courseId }) {
  const needle = search.trim().toLowerCase()
  return enrolments.filter((e) => {
    if (status && e.status !== status) return false
    if (courseId && String(e.course.id) !== courseId) return false
    if (!needle) return true
    return [e.student.fullName, e.student.email, e.course.title].some((field) =>
      field.toLowerCase().includes(needle),
    )
  })
}

// Unique courses present in the enrolment data, ordered by title.
export function courseOptions(enrolments) {
  const byId = new Map()
  for (const e of enrolments) byId.set(String(e.course.id), e.course.title)
  return [...byId].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title))
}
