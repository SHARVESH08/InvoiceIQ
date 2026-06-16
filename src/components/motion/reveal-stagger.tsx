'use client'

import { ReactNode, Children } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Staggered scroll-reveal for a list/grid of children.
 * Note: children are keyed by index, so this is intended for STATIC lists.
 * Wrapping conditionally-toggled children can cause already-visible items to
 * re-animate when indices shift.
 */
export function RevealStagger({
  children,
  className = '',
  step = 0.06,
}: {
  children: ReactNode
  className?: string
  step?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <div className={className}>
      {Children.map(children, (child, i) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: i * step, ease: [0.16, 1, 0.3, 1] }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}
