import { coursesApi } from '../api/endpoints'
import { CourseCard } from '../components/CourseCard'
import { Reveal, RevealItem, Stagger } from '../components/Reveal'
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
      <Stagger as="ul" className="course-grid" aria-label="Courses">
        {courses.map((course) => (
          <RevealItem as="li" key={course.id}>
            <CourseCard course={course} />
          </RevealItem>
        ))}
      </Stagger>
    )

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <Reveal>
            <p className="eyebrow eyebrow--light">Eduyarp · Professional training</p>
            <h1 className="page-hero__title">Course catalogue</h1>
            <p className="page-hero__text">
              Structured modules, trainer-led sessions and progress tracking — all in one place.
              Choose a course to see what you will learn.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section" aria-labelledby="catalogue-title">
        <div className="container">
          <div className="section__header">
            <h2 id="catalogue-title" className="section__title">
              Open for enrolment
            </h2>
            {courses?.length > 0 && (
              <p className="section__meta">
                {courses.length} {courses.length === 1 ? 'course' : 'courses'}
              </p>
            )}
          </div>
          {content}
        </div>
      </section>
    </>
  )
}
