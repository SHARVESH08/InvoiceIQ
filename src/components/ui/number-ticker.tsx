'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'

/**
 * Counts up to `value` when scrolled into view (MagicUI pattern, 21st.dev).
 * State-driven (no textContent mutation), so it never fights React reconciliation.
 * Renders the final value immediately under prefers-reduced-motion.
 * SSR-safe: server and first client render both emit the formatted 0.
 */
export function NumberTicker({
  value,
  decimalPlaces = 0,
  prefix = '',
  suffix = '',
  className,
}: {
  value: number
  decimalPlaces?: number
  prefix?: string
  suffix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  const isInView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { damping: 32, stiffness: 90 })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!reduce && isInView) motionValue.set(value)
  }, [isInView, value, motionValue, reduce])

  useEffect(() => {
    if (reduce) return
    return spring.on('change', (latest) => setDisplay(latest))
  }, [spring, reduce])

  const shown = reduce ? value : display
  const text =
    prefix +
    Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(Number(shown.toFixed(decimalPlaces))) +
    suffix

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  )
}
