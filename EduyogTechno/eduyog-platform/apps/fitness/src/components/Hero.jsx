import { SERVICES } from '../content'
import { Icon } from './Icon'

export function Hero() {
  return (
    <section className="hero" id="home" aria-labelledby="hero-title">
      <div className="container hero__grid">
        <div className="hero__content">
          <p className="eyebrow eyebrow--light">Corporate fitness &amp; wellness</p>
          <h1 className="hero__title" id="hero-title">
            Healthier teams start with <span>everyday wellbeing</span>
          </h1>
          <p className="hero__lead">
            Eduyog Fitness offers corporate wellness, fitness programs and employee fitness
            initiatives that help organisations make health and activity part of working life.
          </p>
          <div className="hero__actions">
            <a className="btn btn--primary btn--lg" href="#contact">
              Make an enquiry
              <Icon name="arrow-right" size={18} />
            </a>
            <a className="btn btn--ghost-light btn--lg" href="#services">
              Explore services
            </a>
          </div>
        </div>

        <nav className="hero__panel" aria-labelledby="hero-panel-title">
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
        </nav>
      </div>
    </section>
  )
}
