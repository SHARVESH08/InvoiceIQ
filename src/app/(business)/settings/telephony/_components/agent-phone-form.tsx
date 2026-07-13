'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { saveAgentPhone } from '@/lib/actions/telephony'

export function AgentPhoneForm({ currentPhone }: { currentPhone: string | null }) {
  const router = useRouter()
  const [phone, setPhone] = useState(currentPhone ?? '')
  const [isPending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await saveAgentPhone(phone)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Your number is saved')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Your phone number
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-2">
            <Label htmlFor="agent-phone">
              When you click Call, Exotel rings this number first
            </Label>
            <Input
              id="agent-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98xxxxxxxx"
              required
            />
          </div>
          <Button type="submit" disabled={isPending || phone.trim().length < 8}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
