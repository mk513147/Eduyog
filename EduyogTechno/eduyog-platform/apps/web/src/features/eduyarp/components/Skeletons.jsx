// Placeholder cards shown while the catalogue loads: the same shape as a course card, so the page does not
// jump when the real cards arrive. role="status" with a text label keeps the loading state announced.
export function CourseGridSkeleton({ count = 3, label = 'Loading courses…' }) {
  return (
    <div role="status">
      <span className="visually-hidden">{label}</span>
      <ul className="course-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <li key={index}>
            <div className="course-card course-card--skeleton">
              <div className="course-card__cover skeleton" />
              <div className="course-card__body">
                <span className="skeleton skeleton--line skeleton--short" />
                <span className="skeleton skeleton--line skeleton--title" />
                <span className="skeleton skeleton--line" />
                <span className="skeleton skeleton--line skeleton--mid" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
