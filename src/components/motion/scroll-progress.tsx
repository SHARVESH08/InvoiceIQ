'use client'

import { motion, useScroll, useSpring, useReducedMotion } from 'framer-motion'

/**
 * Thin gold progress bar pinned to the top of the viewport, driven by page
 * scroll. Matches the Midnight Gold accent. Hidden under prefers-reduced-motion.
 */
export function ScrollProgress() {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })

  if (reduce) return null

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-primary/30 via-primary to-primary/30"
    />
  )
}
