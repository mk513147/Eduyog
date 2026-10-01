import { ENQUIRY_TIPS } from '../content'
import { EnquiryForm } from './EnquiryForm'
import { Icon } from './Icon'
import { SectionHeader } from './SectionHeader'

export function Contact() {
  return (
    <section className="section" id="contact" aria-labelledby="contact-title">
      <div className="container contact">
        <div className="contact__intro">
          <SectionHeader
            id="contact-title"
            eyebrow="Contact"
            title="Plan wellness for your team"
            text="Tell us about your organisation and what you are looking for."
            align="start"
          />
          <div className="contact__tips">
            <h3 className="contact__tips-title">Helpful details to include</h3>
            <ul className="check-list">
              {ENQUIRY_TIPS.map((tip) => (
                <li key={tip}>
                  <Icon name="check" size={18} />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="form-card">
          <h3 className="form-card__title">Business enquiry</h3>
          <EnquiryForm />
        </div>
      </div>
    </section>
  )
}
