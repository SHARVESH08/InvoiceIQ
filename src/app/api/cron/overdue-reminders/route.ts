import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { selectOverdueForReminder, type OverdueInvoice } from '@/lib/cron/overdue-reminders'

export const runtime = 'nodejs'

interface InvoiceRow {
  id: string
  due_date: string
  payment_status: string
  customer_email: string | null
  invoice_number: string
  total_amount: number
  reminder_milestones_sent: number[]
  company_id: string
  companies: { name: string } | null
  customers: { name: string } | null
}

export async function POST(req: NextRequest) {
  // T-11-12: CRON_SECRET check — 500 if undefined (misconfiguration), 401 if mismatch
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // T-11-13: Service role key — server-only, bypasses RLS for cron operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const resend = new Resend(process.env.RESEND_API_KEY)
    const today = new Date().toISOString().split('T')[0]

    // Fetch candidate invoices: unpaid/overdue with customer emails
    const { data: invoiceRows, error: fetchError } = await supabase
      .from('invoices')
      .select(
        'id, due_date, payment_status, customer_email, invoice_number, total_amount, reminder_milestones_sent, company_id, companies(name), customers(name)'
      )
      .in('payment_status', ['unpaid', 'overdue'])
      .not('customer_email', 'is', null)

    if (fetchError) {
      console.error('[overdue-reminders] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
    }

    // Supabase types to-one FK joins (companies/customers) as arrays, but at runtime
    // they resolve to a single object|null — cast through unknown (project pattern).
    const rows = (invoiceRows ?? []) as unknown as InvoiceRow[]

    // PORTAL-05: respect the customer's email_reminders opt-out preference.
    // The preference lives on customer_profiles (matched by email); skip opted-out addresses.
    const { data: optOutRows } = await supabase
      .from('customer_profiles')
      .select('email')
      .eq('email_reminders', false)
    const optOutEmails = new Set(
      (optOutRows ?? [])
        .map((r) => (r.email ?? '').toLowerCase())
        .filter((e) => e.length > 0)
    )

    // Map to OverdueInvoice shape for pure function
    const overdueInvoices: OverdueInvoice[] = rows.map((r) => ({
      id: r.id,
      due_date: r.due_date,
      payment_status: r.payment_status,
      customer_email: r.customer_email,
      reminder_milestones_sent: r.reminder_milestones_sent ?? [],
    }))

    // Pure function selects which invoice+day pairs need reminders today
    const reminders = selectOverdueForReminder(overdueInvoices, today)

    let reminded = 0
    let skipped = 0

    for (const { invoice, day } of reminders) {
      // T-11-14: Re-fetch payment_status to prevent race-window email after payment
      const { data: fresh } = await supabase
        .from('invoices')
        .select('payment_status')
        .eq('id', invoice.id)
        .single()

      if (!fresh || fresh.payment_status === 'paid' || fresh.payment_status === 'cancelled') {
        skipped++
        continue
      }

      const row = rows.find((r) => r.id === invoice.id)!

      // PORTAL-05: skip customers who opted out of email reminders
      if (row.customer_email && optOutEmails.has(row.customer_email.toLowerCase())) {
        skipped++
        continue
      }

      const companyName = row.companies?.name ?? 'InvoiceIQ'
      // total_amount is stored in rupees (computeInvoiceTotals → roundToRupee), NOT paise
      const totalRupees = Number(row.total_amount).toFixed(2)

      const { error: emailError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: invoice.customer_email!,
        subject: `Payment reminder: Invoice ${row.invoice_number} overdue by ${day} days`,
        text: [
          `Dear ${row.customers?.name ?? 'Customer'},`,
          '',
          `This is a reminder that invoice ${row.invoice_number} from ${companyName} is overdue by ${day} day(s).`,
          '',
          `Invoice number: ${row.invoice_number}`,
          `Amount due:     ₹${totalRupees}`,
          `Due date:       ${row.due_date}`,
          '',
          'Please arrange payment at your earliest convenience.',
          '',
          `Thank you,`,
          companyName,
        ].join('\n'),
      })

      if (emailError) {
        console.error(`[overdue-reminders] Resend error for invoice ${invoice.id}:`, emailError)
        skipped++
        continue
      }

      // T-11-17: Update milestone array after successful send (idempotent on re-run)
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ reminder_milestones_sent: [...invoice.reminder_milestones_sent, day] })
        .eq('id', invoice.id)
      if (updateError) {
        console.error(`[overdue-reminders] milestone update failed for invoice ${invoice.id}:`, updateError)
        skipped++
        continue
      }

      reminded++
    }

    const processed = rows.length
    console.log(`[overdue-reminders] processed=${processed} reminded=${reminded} skipped=${skipped} date=${today}`)

    return NextResponse.json({ processed, reminded, skipped }, { status: 200 })
  } catch (err) {
    console.error('[overdue-reminders] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
