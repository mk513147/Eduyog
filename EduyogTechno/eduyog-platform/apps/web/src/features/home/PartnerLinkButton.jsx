import { Link } from '../../router/Link'

// "Become a Partner" destination, resolved by lib/partnerLink.js. An app path uses the client-side
// router; an external URL (only when VITE_FITNESS_URL overrides it) is a plain anchor (same tab, as on the original page).
export function PartnerLinkButton({ link, className, children }) {
  if (link.kind === 'internal') {
    return (
      <Link className={className} to={link.href}>
        {children}
      </Link>
    )
  }
  return (
    <a className={className} href={link.href}>
      {children}
    </a>
  )
}
