import { useEffect } from 'react'

// The certificate prints on A4 landscape. An "@page" rule cannot be scoped to a root class, and a
// global one would also change how the rest of the site prints once Eduyarp's CSS is loaded, so it is
// added only while the certificate page is on screen (the original app declared it in certificates.css).
export function usePrintPageSize(size = 'A4 landscape', margin = '10mm') {
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-eduyarp-print-page', '')
    style.textContent = `@page { size: ${size}; margin: ${margin}; }`
    document.head.appendChild(style)
    return () => style.remove()
  }, [size, margin])
}
