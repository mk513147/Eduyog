import { SERVICES } from '../content'
import { Icon } from './Icon'
import { SectionHeader } from './SectionHeader'

export function Services() {
  return (
    <section className="section" id="services" aria-labelledby="services-title">
      <div className="container">
        <SectionHeader
          id="services-title"
          eyebrow="Services"
          title="Wellness services for modern workplaces"
          text="Choose a single service or combine them into a plan that suits your organisation."
        />

        <div className="card-grid">
          {SERVICES.map((service) => (
            <article className="service-card" id={service.id} key={service.id}>
              <span className="service-card__icon">
                <Icon name={service.icon} size={26} />
              </span>
              <h3 className="service-card__title">{service.title}</h3>
              <p className="service-card__text">{service.text}</p>
              <ul className="check-list">
                {service.points.map((point) => (
                  <li key={point}>
                    <Icon name="check" size={18} />
                    {point}
                  </li>
                ))}
              </ul>
              <a className="text-link" href="#contact">
                Enquire about this service
                <Icon name="arrow-right" size={16} />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
