import { motion } from 'motion/react'
import { SERVICES } from '../content'
import { Icon } from './Icon'

const EASE = [0.22, 1, 0.36, 1]
const FACTS = ['On-site or online', 'Group sessions', 'Shaped around your workplace']

export function Hero() {
  return (
    <section className="hero" id="home" aria-labelledby="hero-title">
      <div className="hero__rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="container hero__grid">
        <div className="hero__content">
          <motion.p
            className="eyebrow eyebrow--light"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            Corporate fitness &amp; wellness
          </motion.p>
          <motion.h1
            className="hero__title"
            id="hero-title"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
          >
            Healthier teams start with <span>everyday wellbeing</span>
          </motion.h1>
          <motion.p
            className="hero__lead"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Eduyog Fitness offers corporate wellness, fitness programs and employee fitness
            initiatives that help organisations make health and activity part of working life.
          </motion.p>
          <motion.div
            className="hero__actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            {FACTS.map((fact) => (
              <li key={fact}>
                <Icon name="check" size={16} />
                {fact}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.nav
          className="hero__panel"
          aria-labelledby="hero-panel-title"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
        >
          <p className="hero__panel-title" id="hero-panel-title">
            What we offer
          </p>
          <ul className="hero__list">
            {SERVICES.map((service) => (
              <li key={service.id}>
                <a className="hero__item" href={`#${service.id}`}>
                  <span className="hero__item-icon">
                    <Icon name={service.icon} size={22} />
                  </span>
                  <span className="hero__item-text">{service.title}</span>
                  <Icon name="arrow-right" size={18} className="hero__item-arrow" />
                </a>
              </li>
            ))}
          </ul>
        </motion.nav>
      </div>
    </section>
  )
}
