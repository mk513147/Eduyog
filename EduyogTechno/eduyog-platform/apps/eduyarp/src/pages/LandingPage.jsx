import { motion } from 'motion/react'
import { coursesApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { CourseCard } from '../components/CourseCard'
import { Icon } from '../components/Icon'
import { Reveal, RevealItem, Stagger } from '../components/Reveal'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'

const EASE = [0.22, 1, 0.36, 1]

const METHOD = [
  { icon: 'book', title: 'Learn', text: 'Work through structured modules and topics, with video lessons where trainers add them.' },
  { icon: 'layers', title: 'Build', text: 'Build skills step by step, one module at a time, in an order that makes sense.' },
  { icon: 'video', title: 'Practice', text: 'Join scheduled live classes with your trainers and put each topic to work.' },
  { icon: 'target', title: 'Progress', text: 'Mark topics complete and see your course progress update as you go.' },
]

const WHY = [
  { icon: 'layers', title: 'Structured learning', text: 'Every course is organised into modules and topics so you always know what comes next.' },
  { icon: 'play', title: 'Video learning', text: 'Topics can include an embedded video lesson, right next to the notes.' },
  { icon: 'target', title: 'Progress tracking', text: 'See completed topics and overall progress for each course you take.' },
  { icon: 'calendar', title: 'Live classes', text: 'Upcoming classes for your courses appear on your dashboard with a join link.' },
  { icon: 'users', title: 'Trainer support', text: 'Courses are led by assigned trainers who run the live sessions.' },
  { icon: 'cap', title: 'Built for students', text: 'Training for UG, PG and PhD students in Data Science, AI, Prompt Engineering and Software Development.' },
]

function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hero-visual__glow" />
      <motion.div
        className="hv-card hv-card--main"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
      >
        <div className="hv-row">
          <span className="hv-chip">Module 1</span>
          <span className="hv-dots">
            <i /> <i /> <i />
          </span>
        </div>
        <div className="hv-player">
          <span className="hv-play">
            <Icon name="play" size={30} />
          </span>
        </div>
        <span className="hv-line hv-line--lg" />
        <span className="hv-line" />
        <div className="hv-progress">
          <span />
        </div>
      </motion.div>
      <motion.div
        className="hv-card hv-card--float hv-card--class"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.55, ease: EASE }}
      >
        <span className="hv-icon hv-icon--teal">
          <Icon name="calendar" size={18} />
        </span>
        <span>
          <strong>Live class</strong>
          <small>With your trainer</small>
        </span>
      </motion.div>
      <motion.div
        className="hv-card hv-card--float hv-card--done"
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.75, ease: EASE }}
      >
        <span className="hv-icon hv-icon--indigo">
          <Icon name="check" size={18} />
        </span>
        <span>
          <strong>Topic complete</strong>
          <small>Progress updated</small>
        </span>
      </motion.div>
    </div>
  )
}

export default function LandingPage() {
  usePageTitle('Learn skills that move you forward')
  const { status, isStudent } = useAuth()
  const { data: courses } = useResource(coursesApi.list)
  const featured = courses?.slice(0, 3) ?? []

  return (
    <>
      <section className="landing-hero">
        <div className="container landing-hero__grid">
          <div className="landing-hero__copy">
            <motion.p
              className="eyebrow eyebrow--light"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              Eduyarp · Professional training by Eduyog
            </motion.p>
            <motion.h1
              className="landing-hero__title"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
            >
              Learn skills that <span className="text-gradient">move you forward.</span>
            </motion.h1>
            <motion.p
              className="landing-hero__text"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Courses and live classes in Data Science, Artificial Intelligence, Prompt Engineering
              and Software Development — with structured modules, trainer support and progress you
              can see.
            </motion.p>
            <motion.div
              className="landing-hero__actions"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.32 }}
            >
              <Link to="/courses" className="btn btn--light btn--lg">
                Browse courses <Icon name="arrowRight" />
              </Link>
              {status === 'authenticated' && isStudent && (
                <Link to="/dashboard" className="btn btn--outline-light btn--lg">
                  Go to my dashboard
                </Link>
              )}
              {status !== 'authenticated' && (
                <Link to="/register" className="btn btn--outline-light btn--lg">
                  Create free account
                </Link>
              )}
            </motion.div>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section className="section section--lg" aria-labelledby="method-title">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 id="method-title" className="section-head__title">
              A clear path from first topic to finished course
            </h2>
          </Reveal>
          <Stagger as="ol" className="method">
            {METHOD.map((step, index) => (
              <RevealItem as="li" key={step.title} className="method__step">
                <span className="method__num">{String(index + 1).padStart(2, '0')}</span>
                <span className="icon-tile">
                  <Icon name={step.icon} size={22} />
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </RevealItem>
            ))}
          </Stagger>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section section--lg section--tint" aria-labelledby="featured-title">
          <div className="container">
            <Reveal className="section-head section-head--row">
              <div>
                <p className="eyebrow">Featured courses</p>
                <h2 id="featured-title" className="section-head__title">
                  Start with a course
                </h2>
              </div>
              <Link to="/courses" className="text-link">
                See all courses <Icon name="arrowRight" size={16} />
              </Link>
            </Reveal>
            <Stagger as="ul" className="course-grid">
              {featured.map((course) => (
                <RevealItem as="li" key={course.id}>
                  <CourseCard course={course} />
                </RevealItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      <section className="section section--lg" aria-labelledby="why-title">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Why Eduyarp</p>
            <h2 id="why-title" className="section-head__title">
              Everything you need to learn in one place
            </h2>
          </Reveal>
          <Stagger as="ul" className="why-grid">
            {WHY.map((item) => (
              <RevealItem as="li" key={item.title} className="why-card">
                <span className="icon-tile icon-tile--soft">
                  <Icon name={item.icon} size={20} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </RevealItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="container cta-wrap">
        <Reveal className="cta">
          <div>
            <h2>Ready to start learning?</h2>
            <p>Pick a course, enrol, and work through it at your own pace.</p>
          </div>
          <Link to="/courses" className="btn btn--light btn--lg">
            Explore courses <Icon name="arrowRight" />
          </Link>
        </Reveal>
      </section>
    </>
  )
}
