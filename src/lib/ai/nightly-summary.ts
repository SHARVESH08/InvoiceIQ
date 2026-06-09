import 'server-only'

import { askGroq, DaySnapshot } from '@/lib/ai/groq'

const NIGHTLY_SUMMARY_SYSTEM_PROMPT = `You are a concise business analyst for an Indian SMB using InvoiceIQ.
Given yesterday's business data, write exactly 3 sentences:
1. Total sales count and revenue in rupees
2. Top-selling product
3. Pending invoices count and outstanding value
Be direct. Use ₹ symbol. No markdown.`

export async function generateNightlySummary(snapshot: DaySnapshot): Promise<string> {
  try {
    const userContent = JSON.stringify({
      date: snapshot.date,
      invoice_count: snapshot.invoice_count,
      revenue_rupees: (snapshot.revenue / 100).toFixed(2),
      top_product: snapshot.top_product,
      pending_count: snapshot.pending_count,
      pending_value_rupees: (snapshot.pending_value / 100).toFixed(2),
    })
    return await askGroq(userContent, NIGHTLY_SUMMARY_SYSTEM_PROMPT, 150)
  } catch {
    return 'Summary unavailable.'
  }
}
