import { APPROACH } from '../content'
import { BotanicalDecor } from './BotanicalDecor'
import { Icon } from './Icon'
import { Reveal, RevealItem, Stagger } from './Reveal'
import { SectionHeader } from './SectionHeader'

export function Approach() {
  return (
    <section className="section section--dark approach-section" id="approach" aria-labelledby="approach-title">
      <BotanicalDecor variant="silhouette" className="approach__foliage approach__foliage--left" />
      <BotanicalDecor variant="sprig" className="approach__foliage approach__foliage--right" />
      <BotanicalDecor variant="flow" className="approach__flow" />
      <div className="container">
        <Reveal y={12}>
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
              <span className="approach__icon">
                <Icon name={step.icon} size={22} />
              </span>
              <span className="approach__num">{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              {index < APPROACH.length - 1 && <Icon name="arrow-right" size={18} className="approach__arrow" />}
            </RevealItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
