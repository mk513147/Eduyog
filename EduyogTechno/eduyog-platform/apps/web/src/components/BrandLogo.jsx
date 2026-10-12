// The Eduyog logo, loaded from the shared asset (assets/shared/eduyog-logo.svg) and bundled with a
// hashed filename, so it never depends on a root path such as /logo.svg.
import logoUrl from '../../../../assets/shared/eduyog-logo.svg'

export function BrandLogo({ className = 'logo__img', size = 40 }) {
  return <img className={className} src={logoUrl} alt="" width={size} height={size} decoding="async" />
}
