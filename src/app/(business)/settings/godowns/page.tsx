import Link from 'next/link'
import { Warehouse } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

import { GodownDetailsList } from './_components/godown-details-list'

// ─────────────────────────────────────────────────────────────────────────────
// Settings → Godowns (RSC)
// Details-only editor. Creating, deactivating and the operational overview live
// on the top-level /godowns page; this tab exists purely to correct the name or
// address of a godown that already exists. Inactive godowns are excluded —
// editing something that no operation can reach is noise.
// ─────────────────────────────────────────────────────────────────────────────

export default async function GodownSettingsPage() {
  const supabase = await createClient()

  const { data: godowns } = await supabase
    .from('godowns')
    .select('id, name, address, is_default')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Godown Details</h1>
        <p className="text-sm text-muted-foreground">
          Change the name or address of an existing godown. To add or deactivate
          one, use the{' '}
          <Link href="/godowns" className="text-primary underline-offset-4 hover:underline">
            Godowns
          </Link>{' '}
          page.
        </p>
      </div>

      {(godowns ?? []).length === 0 ? (
        <div className="text-center py-12">
          <Warehouse className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-base font-semibold">No active godowns</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create one before you can edit its details.
          </p>
          <Button asChild size="sm">
            <Link href="/godowns">Go to Godowns</Link>
          </Button>
        </div>
      ) : (
        <GodownDetailsList godowns={godowns ?? []} />
      )}
    </div>
  )
}
