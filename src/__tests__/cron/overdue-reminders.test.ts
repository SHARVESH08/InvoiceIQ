/**
 * GREEN tests — selectOverdueForReminder overdue invoice reminder selector
 * Covers: EMAIL-02
 */

import { selectOverdueForReminder, type OverdueInvoice } from '@/lib/cron/overdue-reminders'

describe('selectOverdueForReminder', () => {
  const TODAY = '2026-06-03'

  it('returns invoice+day when 3 days overdue and milestone 3 not yet sent [EMAIL-02]', () => {
    const invoices: OverdueInvoice[] = [
      {
        id: 'i1',
        due_date: '2026-05-31',
        payment_status: 'unpaid',
        customer_email: 'a@b.com',
        reminder_milestones_sent: [],
      },
    ]
    const result = selectOverdueForReminder(invoices, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].invoice.id).toBe('i1')
    expect(result[0].day).toBe(3)
  })

  it('excludes invoice when 3-day milestone already sent [EMAIL-02]', () => {
    const invoices: OverdueInvoice[] = [
      {
        id: 'i2',
        due_date: '2026-05-31',
        payment_status: 'unpaid',
        customer_email: 'a@b.com',
        reminder_milestones_sent: [3],
      },
    ]
    const result = selectOverdueForReminder(invoices, TODAY)
    expect(result).toHaveLength(0)
  })

  it('returns invoice+day:7 when 7 days overdue and only 3-day sent [EMAIL-02]', () => {
    const invoices: OverdueInvoice[] = [
      {
        id: 'i3',
        due_date: '2026-05-27',
        payment_status: 'unpaid',
        customer_email: 'a@b.com',
        reminder_milestones_sent: [3],
      },
    ]
    const result = selectOverdueForReminder(invoices, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].invoice.id).toBe('i3')
    expect(result[0].day).toBe(7)
  })

  it('excludes paid invoices even if overdue by 3 days [EMAIL-02]', () => {
    const invoices: OverdueInvoice[] = [
      {
        id: 'i4',
        due_date: '2026-05-31',
        payment_status: 'paid',
        customer_email: 'a@b.com',
        reminder_milestones_sent: [],
      },
    ]
    const result = selectOverdueForReminder(invoices, TODAY)
    expect(result).toHaveLength(0)
  })

  it('excludes invoices with no customer email [EMAIL-02]', () => {
    const invoices: OverdueInvoice[] = [
      {
        id: 'i5',
        due_date: '2026-05-31',
        payment_status: 'unpaid',
        customer_email: null,
        reminder_milestones_sent: [],
      },
    ]
    const result = selectOverdueForReminder(invoices, TODAY)
    expect(result).toHaveLength(0)
  })
})
