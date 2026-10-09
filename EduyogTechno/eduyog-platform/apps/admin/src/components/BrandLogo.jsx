// The Eduyog logo, loaded from the shared asset (assets/shared/eduyog-logo.svg). It sits next to the
// product name, so it is decorative for screen readers (alt="").
import logoUrl from '../../../../assets/shared/eduyog-logo.svg'

export function BrandLogo({ size = 40, className = '' }) {
  return (
    <img
      className={`brand__logo${className ? ` ${className}` : ''}`}
      src={logoUrl}
      alt=""
      width={size}
      height={size}
      decoding="async"
    />
  )
}
