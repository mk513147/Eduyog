import { APPROACH } from '../content'
import { Icon } from './Icon'
import { Reveal, RevealItem, Stagger } from './Reveal'
import { SectionHeader } from './SectionHeader'

export function Approach() {
  return (
    <section className="section section--dark" id="approach" aria-labelledby="approach-title">
      <div className="container">
        <Reveal>
          <SectionHeader
            id="approach-title"
            eyebrow="Our approach"
            title="From first conversation to ongoing engagement"
            text="A simple, practical process that starts with your team."
            tone="light"
          />
        </Reveal>
        <Stagger as="ol" className="approach">
          {APPROACH.map((step, index) => (
            <RevealItem as="li" className="approach__step" key={step.title}>
              <span className="approach__num">{String(index + 1).padStart(2, '0')}</span>
              <span className="approach__icon">
                <Icon name={step.icon} size={22} />
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </RevealItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
