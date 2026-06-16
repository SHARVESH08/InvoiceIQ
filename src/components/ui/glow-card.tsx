'use client'

import { ReactNode } from 'react'
import { GlowCard } from './spotlight-card'

/**
 * SpotlightCard — project-standard gold spotlight container.
 * Use sparingly: dashboard hero KPI, landing hero/feature panels, final CTA.
 */
export function SpotlightCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <GlowCard glowColor="gold" customSize className={className}>
      {children}
    </GlowCard>
  )
}
