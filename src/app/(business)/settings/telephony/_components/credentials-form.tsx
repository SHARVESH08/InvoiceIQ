'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { saveTelephonySettings } from '@/lib/actions/telephony'

interface CredentialsFormProps {
  configured: boolean
  accountSidMasked: string | null
  virtualNumber: string | null
  recordCalls: boolean
}

/** Admin-only (enforced by RLS server-side); secrets are write-only here. */
export function CredentialsForm({
  configured,
  accountSidMasked,
  virtualNumber,
  recordCalls,
}: CredentialsFormProps) {
  const router = useRouter()
  const [accountSid, setAccountSid] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [exophone, setExophone] = useState(virtualNumber ?? '')
  const [record, setRecord] = useState(recordCalls)
  const [isPending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await saveTelephonySettings({
        account_sid: accountSid,
        api_key: apiKey,
        api_token: apiToken,
        virtual_number: exophone,
        record_calls: record,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Exotel connected')
      setAccountSid('')
      setApiKey('')
      setApiToken('')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Exotel account (admins only)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {configured && (
          <p className="mb-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
            Connected — account {accountSidMasked}, Exophone {virtualNumber}.
            Re-submit the form to rotate credentials.
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tel-sid">Account SID</Label>
              <Input
                id="tel-sid"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel-exophone">Exophone (virtual number)</Label>
              <Input
                id="tel-exophone"
                value={exophone}
                onChange={(e) => setExophone(e.target.value)}
                placeholder="08047xxxxxx"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel-key">API key</Label>
              <Input
                id="tel-key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel-token">API token</Label>
              <Input
                id="tel-token"
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Record calls</p>
              <p className="text-xs text-muted-foreground">
                Recordings appear on the customer timeline after each call.
              </p>
            </div>
            <Switch checked={record} onCheckedChange={setRecord} aria-label="Record calls" />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {configured ? 'Update credentials' : 'Connect Exotel'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
