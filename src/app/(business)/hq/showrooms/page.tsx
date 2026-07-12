import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  getFranchiseGroupId,
  getFranchiseOverview,
  getShowroomComparison,
} from '@/lib/actions/franchise'
import { CreateGroupForm } from './_components/create-group-form'
import { InviteShowroomForm } from './_components/invite-showroom-form'
import { ShowroomComparisonTable } from '../_components/showroom-comparison-table'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// HQ > Showrooms — group creation, invite management, member list.
// ─────────────────────────────────────────────────────────────────────────────

export default async function HqShowroomsPage() {
  const groupId = await getFranchiseGroupId()

  if (!groupId) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12">
        <div>
          <h1 className="font-display text-2xl font-semibold">Create your franchise group</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A group links your showrooms without merging their data. After
            creating it, invite each showroom by its GSTIN; that showroom&apos;s
            admin has to accept before anything is shared.
          </p>
        </div>
        <CreateGroupForm />
      </div>
    )
  }

  const [overview, comparison] = await Promise.all([
    getFranchiseOverview(),
    getShowroomComparison(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Manage showrooms</h1>
          <p className="text-sm text-muted-foreground">
            {overview?.group_name ?? 'Franchise group'} · invite a showroom or review members
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/hq">
            <ArrowLeft className="mr-1 size-4" /> Back to overview
          </Link>
        </Button>
      </div>

      <InviteShowroomForm groupId={groupId} />

      <ShowroomComparisonTable rows={comparison} />
    </div>
  )
}
