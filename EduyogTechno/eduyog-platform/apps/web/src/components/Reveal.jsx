import { useEffect, useRef, useState } from 'react'

// Scroll reveal: the element fades in once as it enters the viewport (CSS: .reveal / .is-visible).
// With reduced motion or without IntersectionObserver it is shown immediately. Visibility is React
// state (not a classList edit) so it survives className changes on re-render.
export function Reveal({ as: Tag = 'div', delayIndex = 0, className = '', children, ...props }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || !('IntersectionObserver' in window)) {
      setVisible(true) // eslint-disable-line react-hooks/set-state-in-effect
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Small stagger for siblings revealed together, as on the original page.
  const style = { transitionDelay: `${(delayIndex % 3) * 70}ms` }
  return (
    <Tag ref={ref} className={`reveal ${className}${visible ? ' is-visible' : ''}`.trim()} style={style} {...props}>
      {children}
    </Tag>
  )
}
