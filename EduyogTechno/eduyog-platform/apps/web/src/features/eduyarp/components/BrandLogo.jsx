// The Eduyog logo: the shell's shared logo component (assets/shared/eduyog-logo.svg), with the
// class Eduyarp's CSS styles. Decorative (alt=""), it sits next to the product name.
import { BrandLogo as SharedLogo } from '../../../components/BrandLogo'

export function BrandLogo({ size = 40, className = '' }) {
  return <SharedLogo className={`brand__logo${className ? ` ${className}` : ''}`} size={size} />
}
