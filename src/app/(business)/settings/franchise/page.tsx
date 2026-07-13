import { Building2 } from 'lucide-react'

import { getCompanyInvites } from '@/lib/actions/franchise'
import { InviteResponseCard } from './_components/invite-response-card'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// Settings > Franchise — pending group invites addressed to this company.
// Visible data is RLS-gated: only this company's admins see its invites.
// ─────────────────────────────────────────────────────────────────────────────

export default async function FranchiseSettingsPage() {
  const invites = await getCompanyInvites()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Franchise</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invitations to join a franchise group. Accepting links this company to
          the group and gives the group&apos;s owners admin access here; your
          data stays in this account either way.
        </p>
      </div>

      {invites.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Building2 className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => (
            <InviteResponseCard key={invite.id} invite={invite} />
          ))}
        </div>
      )}
    </div>
  )
}
