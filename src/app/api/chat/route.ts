export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyIntent } from '@/lib/ai/router'
import { resolveIntent } from '@/lib/ai/resolver'
import { askGroq } from '@/lib/ai/groq'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth check — getUser validates session server-side (AUTH-08)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse and validate body
    let body: { message?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const rawMessage = body.message
    if (!rawMessage || typeof rawMessage !== 'string' || !rawMessage.trim()) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 })
    }

    // 3. Sanitize: cap at 500 chars (T-11-22 — token budget exhaustion)
    const message = rawMessage.trim().slice(0, 500)

    // 4. Tenant isolation via get_company_id RPC
    const { data: companyId } = await supabase.rpc('get_company_id')
    if (!companyId) {
      return NextResponse.json({ error: 'No company' }, { status: 403 })
    }

    // 5. Rule-based classification
    const intent = classifyIntent(message)

    // 6. Rule path — SQL resolver
    if (intent !== null) {
      const answer = await resolveIntent(supabase, companyId as string, intent)
      return NextResponse.json({ answer, source: 'rule' })
    }

    // 7. Groq fallback — build company context server-side (T-11-19)
    const { data: summaryRow } = await supabase
      .from('nightly_summaries')
      .select('summary_text')
      .eq('company_id', companyId)
      .order('summary_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    let companyContext: string
    if (summaryRow && (summaryRow as { summary_text: string }).summary_text) {
      companyContext = (summaryRow as { summary_text: string }).summary_text
    } else {
      companyContext = `InvoiceIQ business assistant. Company ID: ${companyId}. Date: ${new Date().toISOString().split('T')[0]}.`
    }

    // T-11-18: userMessage passed as separate 'user' role — NOT interpolated into system prompt
    const answer = await askGroq(message, companyContext, 300)
    return NextResponse.json({ answer, source: 'groq' })
  } catch (err) {
    console.error('[/api/chat] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
