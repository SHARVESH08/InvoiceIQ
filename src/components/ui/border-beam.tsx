'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Animated gold beam that travels along a container's border (MagicUI pattern,
 * 21st.dev). Place inside a `position: relative` element. No-op under
 * prefers-reduced-motion. Defaults to the Midnight Gold accent.
 */
export function BorderBeam({
  className,
  size = 180,
  duration = 9,
  delay = 0,
  colorFrom = 'hsl(var(--primary))',
  colorTo = 'hsl(45 100% 72%)',
  borderWidth = 1.5,
}: {
  className?: string
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  borderWidth?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return null

  return (
    <div
      style={{ ['--border-beam-width' as string]: `${borderWidth}px` }}
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit]',
        'border-[length:var(--border-beam-width)] border-transparent',
        '![mask-clip:padding-box,border-box] ![mask-composite:intersect]',
        '[mask:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]',
        className,
      )}
    >
      <motion.div
        className="absolute aspect-square bg-gradient-to-l from-[var(--beam-from)] via-[var(--beam-to)] to-transparent"
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          ['--beam-from' as string]: colorFrom,
          ['--beam-to' as string]: colorTo,
        }}
        initial={{ offsetDistance: '0%' }}
        animate={{ offsetDistance: '100%' }}
        transition={{ repeat: Infinity, ease: 'linear', duration, delay: -delay }}
      />
    </div>
  )
}
