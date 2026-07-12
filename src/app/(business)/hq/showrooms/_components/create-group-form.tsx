'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createFranchiseGroup } from '@/lib/actions/franchise'

export function CreateGroupForm() {
  const [name, setName] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createFranchiseGroup(name)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Franchise group created')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card/40 p-5">
      <div className="space-y-2">
        <Label htmlFor="group-name">Group name</Label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sharma Auto Group"
          maxLength={80}
          required
          minLength={2}
        />
        <p className="text-xs text-muted-foreground">
          Shown to showroom admins when they receive your invite.
        </p>
      </div>
      <Button type="submit" disabled={isPending || name.trim().length < 2}>
        {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Create group
      </Button>
    </form>
  )
}
