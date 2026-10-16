import { SERVICES } from '../content'
import corporateImage from '../../../../../../assets/fitness/Corporate Wellness.png'
import fitnessImage from '../../../../../../assets/fitness/Fitness Programs.png'
import employeeImage from '../../../../../../assets/fitness/Employee Fitness Initiatives.png'
import { Icon } from './Icon'
import { Reveal, RevealItem, Stagger } from './Reveal'
import { SectionHeader } from './SectionHeader'
import { ServiceArtwork } from './ServiceArtwork'

const SERVICE_IMAGES = {
  'corporate-wellness': {
    src: corporateImage,
    alt: 'Woman sitting cross-legged in a meditation pose outdoors with her hands resting on her knees',
    variant: 'corporate',
    width: 1200,
    height: 1600,
  },
  'fitness-programs': {
    src: fitnessImage,
    alt: 'Yoga practitioner stretching outdoors during a fitness session',
    variant: 'programs',
    width: 1600,
    height: 1200,
  },
  'employee-initiatives': {
    src: employeeImage,
    alt: 'Yoga practitioner holding a side stretch outdoors',
    variant: 'initiatives',
    width: 1600,
    height: 1200,
  },
}

export function Services() {
  return (
    <section className="section services-section" id="services" aria-labelledby="services-title">
      <div className="container">
        <Reveal>
          <SectionHeader
            id="services-title"
            eyebrow="Services"
            title="Wellness services for modern workplaces"
            text="Choose a single service or combine them into a plan that suits your organisation."
          />
        </Reveal>

        <Stagger className="card-grid services-section__grid">
          {SERVICES.map((service) => (
            <RevealItem as="article" className="service-card" id={service.id} key={service.id}>
              <div className="service-card__heading">
                <span className="service-card__icon">
                  <Icon name={service.icon} size={23} />
                </span>
                <h3 className="service-card__title">{service.title}</h3>
              </div>
              <p className="service-card__text">{service.text}</p>
              <ServiceArtwork {...SERVICE_IMAGES[service.id]} />
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
            </RevealItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
