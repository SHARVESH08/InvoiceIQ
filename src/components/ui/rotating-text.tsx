'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Inline vertical word-rotator (adapted from the shadcn "animated-hero" pattern).
 * Reserves the width of the widest word with an invisible placeholder so the
 * surrounding headline never reflows, and slides words in/out on a spring.
 * Renders the first word statically under prefers-reduced-motion.
 */
export function RotatingText({
  words,
  interval = 2200,
  className = '',
}: {
  words: string[]
  interval?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduce) return
    const id = setTimeout(() => setIndex((i) => (i + 1) % words.length), interval)
    return () => clearTimeout(id)
  }, [index, words, interval, reduce])

  if (reduce) {
    return <span className={className}>{words[0]}</span>
  }

  // Invisible placeholder holds the inline box size + baseline = widest word.
  const widest = words.reduce((a, b) => (b.length > a.length ? b : a), '')

  return (
    <span className="relative inline-block overflow-hidden">
      <span aria-hidden className={`invisible ${className}`}>
        {widest}
      </span>
      {words.map((word, i) => (
        <motion.span
          key={word}
          aria-hidden={index !== i}
          className={`absolute left-0 top-0 whitespace-nowrap ${className}`}
          initial={false}
          animate={
            index === i
              ? { y: '0%', opacity: 1 }
              : { y: index > i ? '-120%' : '120%', opacity: 0 }
          }
          transition={{ type: 'spring', stiffness: 60, damping: 14 }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}
