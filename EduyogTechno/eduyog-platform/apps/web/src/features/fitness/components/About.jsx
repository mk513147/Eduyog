import { ABOUT_POINTS } from '../content'
import { Icon } from './Icon'
import { SectionHeader } from './SectionHeader'

export function About() {
  return (
    <section className="section section--tinted" id="about" aria-labelledby="about-title">
      <div className="container about">
        <div className="about__intro">
          <SectionHeader
            id="about-title"
            eyebrow="About"
            title="Eduyog Fitness, from Eduyog Techno Solution"
            align="start"
          />
          <p className="about__text">
            Eduyog Fitness is the fitness and wellness service offering of Eduyog Techno Solution.
            We work with organisations that want to support the health and wellbeing of their
            people through practical, well-planned activities.
          </p>
          <p className="about__text">
            Whether you are starting a new wellness initiative or looking to add fitness activities
            for your team, we will work with you to understand your needs and suggest a suitable
            approach.
          </p>
        </div>

        <ul className="about__points">
          {ABOUT_POINTS.map((point) => (
            <li className="about__point" key={point.title}>
              <span className="about__point-icon">
                <Icon name={point.icon} size={22} />
              </span>
              <div>
                <h3 className="about__point-title">{point.title}</h3>
                <p className="about__point-text">{point.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
