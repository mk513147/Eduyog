import { motion, useReducedMotion } from 'motion/react'

// Scroll-triggered fade + slight rise. For users who prefer reduced motion nothing is hidden or moved: the
// content is simply there from the first frame (so it never waits for a scroll or an animation).
export function Reveal({ children, delay = 0, y = 18, as = 'div', className, ...rest }) {
  const Tag = motion[as] ?? motion.div
  const reduce = useReducedMotion()
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

// Container whose direct <RevealItem> children stagger in.
export function Stagger({ children, className, as = 'div', gap = 0.07, ...rest }) {
  const Tag = motion[as] ?? motion.div
  const reduce = useReducedMotion()
  return (
    <Tag
      className={className}
      initial={reduce ? 'show' : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function RevealItem({ children, className, as = 'div', ...rest }) {
  const Tag = motion[as] ?? motion.div
  const reduce = useReducedMotion()
  return (
    <Tag
      className={className}
      variants={{
        hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
