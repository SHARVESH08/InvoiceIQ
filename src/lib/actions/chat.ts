'use server'

import { createClient } from '@/lib/supabase/server'
import { classifyIntent } from '@/lib/ai/router'
import { resolveIntent } from '@/lib/ai/resolver'
import { askGroq } from '@/lib/ai/groq'

export async function sendChatMessage(
  message: string
): Promise<{ reply: string; source: 'rule' | 'groq' } | { error: string }> {
  if (!message?.trim()) {
    return { error: 'Empty message' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: 'No company found' }
  }

  const sanitized = message.trim().slice(0, 500)

  try {
    const intent = classifyIntent(sanitized)

    if (intent !== null) {
      const answer = await resolveIntent(supabase, companyId as string, intent)
      return { reply: answer, source: 'rule' }
    }

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

    const answer = await askGroq(sanitized, companyContext, 300)
    return { reply: answer, source: 'groq' }
  } catch {
    return { error: 'Chat error' }
  }
}
