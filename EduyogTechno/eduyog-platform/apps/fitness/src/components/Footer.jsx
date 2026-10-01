import { EDUYOG_URL } from '../config'
import { NAV_ITEMS } from '../content'
import { Icon } from './Icon'

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <a className="brand brand--light" href="#home" aria-label="Eduyog Fitness home">
              <span className="brand__mark" aria-hidden="true">E</span>
              <span className="brand__name">
                Eduyog <span>Fitness</span>
              </span>
            </a>
            <p className="footer__about">
              Corporate wellness, fitness programs and employee fitness initiatives from Eduyog
              Techno Solution.
            </p>
          </div>

          <nav className="footer__nav" aria-label="Footer">
            <h2 className="footer__title">Explore</h2>
            <ul className="footer__links">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          {EDUYOG_URL && (
            <div className="footer__eduyog">
              <h2 className="footer__title">Eduyog</h2>
              <a className="btn btn--ghost-light btn--sm" href={EDUYOG_URL}>
                <Icon name="arrow-left" size={16} />
                Back to Eduyog
              </a>
            </div>
          )}
        </div>

        <p className="footer__bottom">
          © {new Date().getFullYear()} Eduyog Techno Solution. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
