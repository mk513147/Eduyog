import { coursesApi } from '../api/endpoints'
import { CourseCard } from '../components/CourseCard'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'

export default function CatalogPage() {
  usePageTitle('Courses')
  const { data: courses, error, loading, reload } = useResource(coursesApi.list)

  let content
  if (loading) content = <LoadingState label="Loading courses…" />
  else if (error && !courses) content = <ErrorState error={error} onRetry={reload} />
  else if (courses.length === 0)
    content = (
      <EmptyState
        title="New courses are coming soon"
        description="There are no courses open for enrolment right now. Please check back later."
      />
    )
  else
    content = (
      <ul className="course-grid" aria-label="Courses">
        {courses.map((course) => (
          <li key={course.id}>
            <CourseCard course={course} />
          </li>
        ))}
      </ul>
    )

  return (
    <>
      <section className="hero">
        <div className="container">
          <p className="eyebrow">Eduyarp · Professional training</p>
          <h1 className="hero__title">Build job-ready skills with guided courses and live classes</h1>
          <p className="hero__text">
            Structured modules, trainer-led sessions and progress tracking — all in one place.
            Choose a course to see what you will learn.
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="catalogue-title">
        <div className="container">
          <div className="section__header">
            <h2 id="catalogue-title" className="section__title">
              Course catalogue
            </h2>
            {courses?.length > 0 && (
              <p className="section__meta">
                {courses.length} {courses.length === 1 ? 'course' : 'courses'} open for enrolment
              </p>
            )}
          </div>
          {content}
        </div>
      </section>
    </>
  )
}
