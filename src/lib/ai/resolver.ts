import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Intent } from '@/lib/ai/router'

function formatRupees(rupees: number): string {
  return Math.round(rupees).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export async function resolveIntent(
  supabase: SupabaseClient,
  companyId: string,
  intent: NonNullable<Intent>
): Promise<string> {
  switch (intent.type) {
    case 'stock_query': {
      const { data } = await supabase
        .from('inventory')
        .select('quantity, products!inner(name)')
        .eq('company_id', companyId)
        .ilike('products.name', `%${intent.product}%`)
        .limit(1)
        .maybeSingle()
      if (!data) {
        return `No product matching "${intent.product}" found.`
      }
      // `products` is a to-one FK join — object at runtime, but the select-string
      // parser infers an array without generated DB types, so cast via unknown.
      const row = data as unknown as { quantity: number; products: { name: string } }
      return `You have ${row.quantity} units of ${row.products.name} in stock.`
    }

    case 'overdue_invoices': {
      const { data } = await supabase
        .from('invoices')
        .select('id, total_amount')
        .eq('company_id', companyId)
        .in('payment_status', ['unpaid', 'overdue'])
        .lt('due_date', new Date().toISOString().split('T')[0])
      if (!data || data.length === 0) {
        return 'No overdue invoices — you are all caught up!'
      }
      const count = data.length
      const total = (data as { total_amount: number }[]).reduce(
        (sum, row) => sum + Number(row.total_amount ?? 0),
        0
      )
      return `You have ${count} overdue invoices totalling ₹${formatRupees(total)}.`
    }

    case 'invoice_status': {
      const { data } = await supabase
        .from('invoices')
        .select('invoice_number, payment_status')
        .eq('company_id', companyId)
        .ilike('invoice_number', `%${intent.reference}%`)
        .limit(1)
        .maybeSingle()
      if (!data) {
        return `Invoice "${intent.reference}" not found.`
      }
      const row = data as { invoice_number: string; payment_status: string }
      return `Invoice ${row.invoice_number} status: ${row.payment_status}.`
    }

    case 'gst_deadline': {
      const period = intent.period?.toLowerCase() ?? ''
      if (period === '3b') {
        return 'GSTR-3B is due by the 20th of the month following the return period.'
      } else if (period === '9') {
        return 'GSTR-9 annual return is due by 31st December following the financial year end.'
      } else if (period === '1') {
        return 'GSTR-1 is due by the 11th of the month following the return period.'
      } else {
        return 'Check the GSTN portal for the latest GST deadlines.'
      }
    }

    case 'sales_today': {
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]
      const { data } = await supabase
        .from('invoices')
        .select('id, total_amount')
        .eq('company_id', companyId)
        .not('payment_status', 'in', '("cancelled","draft")')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${tomorrow}T00:00:00.000Z`)
      const count = data?.length ?? 0
      const total = (data as { total_amount: number }[] | null)?.reduce(
        (sum, row) => sum + Number(row.total_amount ?? 0),
        0
      ) ?? 0
      return `Today's sales: ${count} invoices totalling ₹${formatRupees(total)}.`
    }

    case 'sales_mtd': {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0]
      const { data } = await supabase
        .from('invoices')
        .select('id, total_amount')
        .eq('company_id', companyId)
        .not('payment_status', 'in', '("cancelled","draft")')
        .gte('created_at', `${monthStart}T00:00:00.000Z`)
      const count = data?.length ?? 0
      const total = (data as { total_amount: number }[] | null)?.reduce(
        (sum, row) => sum + Number(row.total_amount ?? 0),
        0
      ) ?? 0
      return `This month: ${count} invoices totalling ₹${formatRupees(total)}.`
    }

    case 'top_products': {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
      const { data } = await supabase
        .from('invoice_items')
        .select('quantity, products!inner(name), invoices!inner(company_id, created_at, payment_status)')
        .eq('invoices.company_id', companyId)
        .gte('invoices.created_at', `${thirtyDaysAgo}T00:00:00.000Z`)
        .not('invoices.payment_status', 'in', '("cancelled","draft")')
      if (!data || data.length === 0) {
        return 'No sales data available for the last 30 days.'
      }
      // Aggregate by product name
      const totals: Record<string, number> = {}
      for (const row of data as unknown as {
        quantity: number
        products: { name: string }
        invoices: { company_id: string; created_at: string }
      }[]) {
        const name = row.products.name
        totals[name] = (totals[name] ?? 0) + Number(row.quantity)
      }
      const sorted = Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
      if (sorted.length === 0) {
        return 'No top products data available for the last 30 days.'
      }
      const list = sorted.map((e, i) => `${i + 1}. ${e[0]} (${e[1]} units)`).join(' ')
      return `Top selling (last 30 days): ${list}.`
    }

    case 'pending_payments': {
      const { data } = await supabase
        .from('invoices')
        .select('id, total_amount')
        .eq('company_id', companyId)
        .in('payment_status', ['unpaid', 'overdue'])
      const count = data?.length ?? 0
      const total = (data as { total_amount: number }[] | null)?.reduce(
        (sum, row) => sum + Number(row.total_amount ?? 0),
        0
      ) ?? 0
      return `${count} pending payments totalling ₹${formatRupees(total)}.`
    }

    case 'customer_balance': {
      const { data } = await supabase
        .from('invoices')
        .select('total_amount, customers!inner(name)')
        .eq('company_id', companyId)
        .in('payment_status', ['unpaid', 'overdue'])
        .ilike('customers.name', `%${intent.customer}%`)
      if (!data || data.length === 0) {
        return `No outstanding balance found for "${intent.customer}".`
      }
      const rows = data as unknown as { total_amount: number; customers: { name: string } }[]
      const customerName = rows[0].customers.name
      const balance = rows.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0)
      const count = rows.length
      return `${customerName} owes ₹${formatRupees(balance)} across ${count} unpaid invoice${count !== 1 ? 's' : ''}.`
    }

    case 'low_stock': {
      const { data } = await supabase
        .from('inventory')
        .select('quantity, products!inner(name, reorder_level)')
        .eq('company_id', companyId)
        .order('quantity', { ascending: true })
      if (!data || data.length === 0) {
        return 'All products are above reorder level — stock is healthy!'
      }
      const rows = data as unknown as {
        quantity: number
        products: { name: string; reorder_level: number }
      }[]
      const lowItems = rows.filter((r) => r.quantity <= r.products.reorder_level).slice(0, 5)
      if (lowItems.length === 0) {
        return 'All products are above reorder level — stock is healthy!'
      }
      const list = lowItems
        .map((r) => `${r.products.name} (${r.quantity} units)`)
        .join(', ')
      return `${lowItems.length} product${lowItems.length !== 1 ? 's' : ''} at or below reorder level: ${list}.`
    }

    case 'revenue_ytd': {
      const yearStart = new Date(new Date().getFullYear(), 0, 1)
        .toISOString()
        .split('T')[0]
      const { data } = await supabase
        .from('invoices')
        .select('id, total_amount')
        .eq('company_id', companyId)
        .not('payment_status', 'in', '("cancelled","draft")')
        .gte('created_at', `${yearStart}T00:00:00.000Z`)
      const count = data?.length ?? 0
      const total = (data as { total_amount: number }[] | null)?.reduce(
        (sum, row) => sum + Number(row.total_amount ?? 0),
        0
      ) ?? 0
      return `Year-to-date revenue: ₹${formatRupees(total)} across ${count} invoice${count !== 1 ? 's' : ''}.`
    }

    default: {
      return 'I could not find data for that query. Please try rephrasing.'
    }
  }
}
