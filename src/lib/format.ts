// src/lib/format.ts
// Pure utility — usable in both RSC and client components.
// No directives — intentionally framework-agnostic.

/**
 * Format a rupee amount using Indian locale (lakhs/crores separator).
 * Drops paise — use for dashboard KPI display values.
 *
 * formatRupees(124500) → "₹1,24,500"
 * formatRupees(0)      → "₹0"
 */
export function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format a rupee amount with 2 decimal places (for line-item totals).
 *
 * formatRupeesExact(1234.56) → "₹1,234.56"
 */
export function formatRupeesExact(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}
