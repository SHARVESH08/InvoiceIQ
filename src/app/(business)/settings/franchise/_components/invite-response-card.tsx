'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { respondToFranchiseInvite, type CompanyInvite } from '@/lib/actions/franchise'

interface InviteResponseCardProps {
  invite: CompanyInvite
}

export function InviteResponseCard({ invite }: InviteResponseCardProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function respond(accept: boolean) {
    startTransition(async () => {
      const result = await respondToFranchiseInvite(invite.id, accept)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(accept ? `Joined ${invite.group_name}` : 'Invite declined')
      router.refresh()
    })
  }

  const expires = new Date(invite.expires_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium">{invite.group_name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Invited to join this franchise group · expires {expires}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => respond(false)}
            disabled={isPending}
          >
            <X className="mr-1 size-3.5" /> Decline
          </Button>
          <Button size="sm" onClick={() => respond(true)} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Check className="mr-1 size-3.5" />
            )}
            Accept
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
