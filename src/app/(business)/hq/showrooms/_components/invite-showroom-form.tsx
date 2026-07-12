'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, Send } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { findCompanyByGstin, inviteCompanyToFranchise } from '@/lib/actions/franchise'

interface InviteShowroomFormProps {
  groupId: string
}

type FoundCompany = { company_id: string; name: string; already_in_group: boolean }

/**
 * Two-step invite: exact-GSTIN lookup, then send. The showroom's admin sees
 * the pending invite under Settings > Franchise and must accept it there.
 */
export function InviteShowroomForm({ groupId }: InviteShowroomFormProps) {
  const [gstin, setGstin] = useState('')
  const [found, setFound] = useState<FoundCompany | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function lookup(e: React.FormEvent) {
    e.preventDefault()
    setFound(null)
    startTransition(async () => {
      const result = await findCompanyByGstin(gstin)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setFound(result)
    })
  }

  function invite() {
    if (!found) return
    startTransition(async () => {
      const result = await inviteCompanyToFranchise(groupId, found.company_id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Invite sent to ${found.name}. Their admin has to accept it.`)
      setFound(null)
      setGstin('')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Invite a showroom
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={lookup} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1 space-y-2">
            <Label htmlFor="invite-gstin">Showroom GSTIN</Label>
            <Input
              id="invite-gstin"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="27ABCDE1234F1Z5"
              maxLength={15}
              required
            />
          </div>
          <Button type="submit" variant="outline" disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Search className="mr-2 size-4" />
            )}
            Find
          </Button>
        </form>

        {found && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium">{found.name}</p>
              <p className="text-xs text-muted-foreground">
                {found.already_in_group
                  ? 'Already part of a franchise group'
                  : 'Registered on InvoiceIQ · not in any group'}
              </p>
            </div>
            <Button onClick={invite} disabled={isPending || found.already_in_group}>
              <Send className="mr-2 size-4" />
              Send invite
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Accepting the invite links the showroom to your group and gives group
          owners admin access to it. Nothing is shared until their admin accepts.
        </p>
      </CardContent>
    </Card>
  )
}
