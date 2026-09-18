import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatPanel } from '@/components/chat/chat-panel'

// ─────────────────────────────────────────────────────────────────────────────
// Chat page — RSC shell
// Auth + company check happen here; ChatPanel is a client component.
// AI-01, AI-02: rule-based intent router with Groq fallback.
// ─────────────────────────────────────────────────────────────────────────────
export default async function ChatPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) redirect('/login')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold leading-tight">AI Business Assistant</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ask about your sales, stock, invoices, or GST deadlines.
        </p>
      </div>
      <ChatPanel />
    </div>
  )
}
