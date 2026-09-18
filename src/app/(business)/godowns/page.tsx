import { createClient } from '@/lib/supabase/server'
import { GodownsTable } from './_components/godowns-table'

// ─────────────────────────────────────────────────────────────────────────────
// GodownsPage (RSC)
// Fetches all godowns for the current company (RLS scopes to company).
// Returns default godown first, then alphabetical.
// T-06-24: uses createClient (authenticated server-side) — no cross-tenant leak.
// ─────────────────────────────────────────────────────────────────────────────

export default async function GodownsPage() {
  const supabase = await createClient()

  const { data: godowns } = await supabase
    .from('godowns')
    .select('id, name, address, is_default, is_active, company_id')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  return <GodownsTable godowns={godowns ?? []} />
}
