import { motion, useReducedMotion } from 'motion/react'
import heroImage from '../../../../../../assets/fitness/WhatsApp Image 2026-10-13 at 10.50.22 AM.jpeg'
import { SERVICES } from '../content'
import { BotanicalDecor } from './BotanicalDecor'
import { Icon } from './Icon'

const EASE = [0.22, 1, 0.36, 1]
const FACTS = [
  { icon: 'users', label: 'On-site or online' },
  { icon: 'calendar', label: 'Group sessions' },
  { icon: 'leaf', label: 'Shaped around your workplace' },
]

export function Hero() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="hero" id="home" aria-labelledby="hero-title">
      <div className="hero__wash" aria-hidden="true" />
      <BotanicalDecor variant="flow" className="hero__flow" />
      <div className="container hero__grid">
        <div className="hero__content">
          <motion.p
            className="eyebrow eyebrow--light"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            Corporate fitness &amp; wellness
          </motion.p>
          <motion.h1
            className="hero__title"
            id="hero-title"
            initial={reduceMotion ? false : { opacity: 0, y: 22 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
          >
            Healthier teams start with <span>everyday wellbeing</span>
          </motion.h1>
          <motion.p
            className="hero__lead"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Eduyog Fitness offers corporate wellness, fitness programs and employee fitness
            initiatives that help organisations make health and activity part of working life.
          </motion.p>
          <motion.div
            className="hero__actions"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.32 }}
          >
            <a className="btn btn--primary btn--lg" href="#contact">
              Make an enquiry
              <Icon name="arrow-right" size={18} />
            </a>
            <a className="btn btn--ghost-light btn--lg" href="#services">
              Explore services
            </a>
          </motion.div>
          <motion.ul
            className="hero__facts"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            {FACTS.map((fact) => (
              <li key={fact.label}>
                <Icon name={fact.icon} size={19} />
                <span>{fact.label}</span>
              </li>
            ))}
          </motion.ul>
          <nav className="hero__service-links" aria-label="Explore services">
            {SERVICES.map((service) => (
              <a key={service.id} href={`#${service.id}`}>
                {service.title}
              </a>
            ))}
          </nav>
        </div>

        <motion.div
          className="hero__visual"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.2, ease: EASE }}
        >
          <span className="hero__organic" aria-hidden="true" />
          <BotanicalDecor variant="sprig" className="hero__botanical" />
          <div className="hero__photo">
            <img
              src={heroImage}
              alt="Woman sitting in a yoga meditation pose in a garden"
              width="1200"
              height="1600"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
