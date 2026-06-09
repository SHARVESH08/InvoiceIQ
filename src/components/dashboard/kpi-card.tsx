'use client'

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export interface KpiCardProps {
  /** Category label shown above the stat value (12px/400 — text-sm text-muted-foreground) */
  label: string
  /** Stat value to display (28px/700 — text-3xl font-bold). Pass pre-formatted string or raw number. */
  value: string | number
  /**
   * Mark this card as containing financial data.
   * When financial=true and isAdmin=false, the card is absent from the DOM (not hidden via CSS).
   * Per D-04 / T-07-06: accountant, salesperson, and ca are all treated as non-admin.
   */
  financial?: boolean
  /** Whether the current user is an admin. Defaults to true (safe: shows card). */
  isAdmin?: boolean
}

/**
 * KpiCard — reusable stat widget.
 *
 * Financial gating: if financial=true and isAdmin=false, returns null.
 * Card is absent from DOM entirely — no CSS-only hide (data-privacy requirement T-07-06).
 */
export function KpiCard({
  label,
  value,
  financial = false,
  isAdmin = true,
}: KpiCardProps) {
  // T-07-06: financial widgets must never appear in DOM for non-admin users
  if (financial && !isAdmin) return null

  return (
    <Card
      aria-label={`${label}: ${value}`}
      className="min-h-[44px]"
    >
      <CardHeader className="pb-2">
        {/* Label: 12px/400 */}
        <CardDescription className="text-sm text-muted-foreground">
          {label}
        </CardDescription>
        {/* Value: 28px/700 */}
        <CardTitle className="text-3xl font-bold">
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}
