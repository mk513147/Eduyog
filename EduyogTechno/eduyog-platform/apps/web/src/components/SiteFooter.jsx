import { BASE_PATH, CONTACT_EMAIL, WHATSAPP_URL } from '../config'
import { sectionLinks } from '../lib/siteLinks'
import { Link } from '../router/Link'
import { BackToEduyog } from './BackToEduyog'
import { BrandLogo } from './BrandLogo'

function FooterLink({ item }) {
  if (item.to) return <Link to={item.to}>{item.label}</Link>
  return <a href={item.href}>{item.label}</a>
}

// The shared public footer (Eduyog, Eduyarp and Fitness). It only shows information that is verified in
// the repository: the section's own links, the other public sections, the Eduyog contact e-mail and
// WhatsApp link, and the copyright line. Nothing is invented (no address, phone number or social links).
//   current      the section this footer is on ('eduyog' | 'eduyarp' | 'fitness'): left out of "Eduyog".
//   brandLabel   product name beside the logo.
//   tagline      one-line description.
//   exploreLinks [{ label, to | href }] the section's own navigation.
export function SiteFooter({ current, brandLabel, tagline, exploreTitle = 'Explore', exploreLinks = [], brandLink }) {
  const sections = sectionLinks(current, BASE_PATH).filter((item) => item.id !== 'eduyog')
  return (
    <footer className="eg-footer">
      <div className="container eg-footer__grid">
        <div className="eg-footer__brand">
          <div className="eg-footer__logo">
            <BrandLogo className="eg-footer__mark" />
            <span className="eg-footer__name">{brandLabel}</span>
          </div>
          <p className="eg-footer__tagline">{tagline}</p>
          {brandLink}
        </div>

        <nav className="eg-footer__col" aria-label={`${exploreTitle} (footer)`}>
          <h2 className="eg-footer__title">{exploreTitle}</h2>
          <ul>
            {exploreLinks.map((item) => (
              <li key={item.label}>
                <FooterLink item={item} />
              </li>
            ))}
          </ul>
        </nav>

        <nav className="eg-footer__col" aria-label="Eduyog sections (footer)">
          <h2 className="eg-footer__title">Eduyog</h2>
          <ul>
            {current !== 'eduyog' && (
              <li>
                <BackToEduyog />
              </li>
            )}
            {sections.map((item) => (
              <li key={item.id}>
                <FooterLink item={item} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="eg-footer__col">
          <h2 className="eg-footer__title">Contact</h2>
          <ul>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </li>
            <li>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                Chat on WhatsApp<span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="container eg-footer__bottom">
        <p>&copy; {new Date().getFullYear()} Eduyog Techno Solution Pvt. Ltd. All rights reserved.</p>
      </div>
    </footer>
  )
}
