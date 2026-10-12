import { CONTACT_EMAIL, WHATSAPP_URL } from '../../../config'
import { Icon } from './Icon'

/**
 * How a student gets full-course access: they contact Eduyog (purchase and payment happen outside the
 * platform), and an Admin then grants access to their account. Uses only the verified Eduyog email and
 * WhatsApp link from the shared config; the WhatsApp destination and its prefilled message are unchanged.
 */
export function ContactAccess({ courseTitle, heading = 'Want the full course?', compact = false, bar = false }) {
  const subject = encodeURIComponent(courseTitle ? `Full course access: ${courseTitle}` : 'Full course access')
  return (
    <div className={`access-cta${compact ? ' access-cta--compact' : ''}${bar ? ' access-cta--bar' : ''}`}>
      <p className="access-cta__title">
        <Icon name="lock" size={16} /> {heading}
      </p>
      <p className="access-cta__text">
        Contact Eduyog to get full access. Once it is arranged, an admin unlocks the course for your account.
      </p>
      <div className="access-cta__actions">
        <a className="btn btn--primary btn--sm" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          Chat on WhatsApp
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
        <a className="btn btn--secondary btn--sm" href={`mailto:${CONTACT_EMAIL}?subject=${subject}`}>
          Email Eduyog
        </a>
      </div>
    </div>
  )
}
