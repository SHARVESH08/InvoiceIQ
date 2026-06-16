'use client'

import { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Subtle hover/tap physics for interactive cards (clickable tiles, KPI panels).
 * Lifts on hover, presses on tap. No-op under prefers-reduced-motion.
 * Pair with a real <a>/<button> inside — this only adds motion, not semantics.
 */
export function HoverLift({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      whileHover={{ y: -4 }}
      whileTap={{ y: -1, scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    >
      {children}
    </motion.div>
  )
}
