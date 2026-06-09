/**
 * Pure function module for overdue invoice reminder logic.
 * No Supabase, no Resend — fully testable without mocks.
 * Covers: EMAIL-02
 */

export interface OverdueInvoice {
  id: string
  due_date: string                    // ISO date 'YYYY-MM-DD'
  payment_status: string
  customer_email: string | null
  reminder_milestones_sent: number[]  // day numbers already sent (3, 7, 14)
}

const MILESTONES = [3, 7, 14] as const

/**
 * Returns invoice+day pairs that need a reminder sent today.
 *
 * @param invoices  - List of invoices to evaluate (pre-filtered from DB)
 * @param todayISO  - Today's date as 'YYYY-MM-DD'
 */
export function selectOverdueForReminder(
  invoices: OverdueInvoice[],
  todayISO: string
): Array<{ invoice: OverdueInvoice; day: 3 | 7 | 14 }> {
  const results: Array<{ invoice: OverdueInvoice; day: 3 | 7 | 14 }> = []

  const todayMs = new Date(todayISO).getTime()

  for (const invoice of invoices) {
    if (invoice.payment_status !== 'unpaid') continue
    if (!invoice.customer_email) continue

    const dueDateMs = new Date(invoice.due_date).getTime()
    const daysDiff = Math.round((todayMs - dueDateMs) / 86_400_000)

    for (const milestone of MILESTONES) {
      if (daysDiff === milestone && !invoice.reminder_milestones_sent.includes(milestone)) {
        results.push({ invoice, day: milestone })
        // Only one milestone per invoice per run (break after first match)
        break
      }
    }
  }

  return results
}
