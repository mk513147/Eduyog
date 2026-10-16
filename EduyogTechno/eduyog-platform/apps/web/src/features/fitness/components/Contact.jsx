import { useId } from 'react'
import meditationImage from '../../../../../../assets/fitness/WhatsApp Image 2026-10-13 at 10.50.22 AM.jpeg'
import { EnquiryForm } from './EnquiryForm'
import { Icon } from './Icon'
import { SectionHeader } from './SectionHeader'

const CONTACT_FEATURES = [
  {
    icon: 'target',
    title: 'Understand your goals',
    text: 'We learn about your team and needs.',
  },
  {
    icon: 'calendar',
    title: 'Curated recommendations',
    text: 'Programmes suited to your workplace.',
  },
  {
    icon: 'check',
    title: 'Simple next steps',
    text: 'We get back to you with a plan.',
  },
]

export function Contact() {
  const clipId = `fitness-contact-photo-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <section className="section contact-section" id="contact" aria-labelledby="contact-title">
      <div className="container contact">
        <div className="contact__intro">
          <SectionHeader
            id="contact-title"
            eyebrow="LET'S WORK TOGETHER"
            title="Build a stronger, healthier team"
            text="We partner with organisations to create impactful wellness experiences. Tell us a bit about your team and goals, and we’ll suggest the right programs for you."
            align="start"
          />

          <div className="contact__visual">
            <span className="contact__image-backplate" aria-hidden="true" />
            <svg className="contact__clip-defs" width="0" height="0" aria-hidden="true" focusable="false">
              <defs>
                <clipPath id={clipId} clipPathUnits="objectBoundingBox">
                  <path d="M.39.005C.58-.01.83.005.94.09c.12.1.06.23.055.35-.006.12.03.2-.006.31-.04.13-.13.18-.23.22-.1.04-.16.02-.27.03-.17.02-.28.02-.39-.04C-.01.87-.01.76.015.62.04.48.02.39.04.27.06.12.17.02.3.01c.03 0 .06 0 .09-.005Z" />
                </clipPath>
              </defs>
            </svg>
            <img
              className="contact__photo"
              src={meditationImage}
              alt="Woman seated cross-legged outdoors, meditating with her hands resting on her knees"
              width="1200"
              height="1600"
              loading="lazy"
              decoding="async"
              style={{ clipPath: `url(#${clipId})` }}
            />
            <svg className="contact__botanical-art" viewBox="0 0 230 480" fill="none" aria-hidden="true" focusable="false">
              <path className="contact__botanical-stem" d="M24 468C63 405 78 347 112 282c31-60 47-114 57-166 5-28 15-59 37-94" />
              <path className="contact__botanical-leaf" d="M70 374c-38-8-58-34-60-78 41 10 63 37 60 78Z" />
              <path className="contact__botanical-vein" d="m70 374-58-78" />
              <path className="contact__botanical-leaf" d="M91 324c6-42 31-67 75-73-4 43-29 67-75 73Z" />
              <path className="contact__botanical-vein" d="m91 324 75-73" />
              <path className="contact__botanical-leaf" d="M117 270c-40-7-59-31-58-72 41 8 61 31 58 72Z" />
              <path className="contact__botanical-vein" d="M117 270 59 198" />
              <path className="contact__botanical-leaf" d="M145 215c5-39 28-63 67-71-2 41-25 65-67 71Z" />
              <path className="contact__botanical-vein" d="m145 215 67-71" />
              <path className="contact__botanical-leaf" d="M166 158c-34-10-49-33-45-70 36 11 51 34 45 70Z" />
              <path className="contact__botanical-vein" d="m166 158-45-70" />
              <path className="contact__botanical-leaf" d="M186 103c4-35 23-56 57-64-1 37-20 58-57 64Z" />
              <path className="contact__botanical-vein" d="m186 103 57-64" />
            </svg>
            <span className="contact__ornament-dot contact__ornament-dot--one" aria-hidden="true" />
            <span className="contact__ornament-dot contact__ornament-dot--two" aria-hidden="true" />
            <div className="contact__badge">
              <span>Well</span>
              <span>Teams</span>
              <span>Thrive</span>
            </div>
          </div>

          <div className="contact__features">
            {CONTACT_FEATURES.map((feature) => (
              <article className="contact__feature" key={feature.title}>
                <span className="contact__feature-icon">
                  <Icon name={feature.icon} size={21} />
                </span>
                <span className="contact__feature-copy">
                  <span className="contact__feature-title">{feature.title}</span>
                  <span className="contact__feature-text">{feature.text}</span>
                </span>
              </article>
            ))}
          </div>
        </div>

        <div className="form-card contact__form-card">
          <h3 className="form-card__title">Business enquiry</h3>
          <EnquiryForm />
        </div>
      </div>
    </section>
  )
}
