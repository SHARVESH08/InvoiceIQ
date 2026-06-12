'use client'

import { ReactNode, Children } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

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
  return (
    <div className={className}>
      {Children.map(children, (child, i) => (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
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
