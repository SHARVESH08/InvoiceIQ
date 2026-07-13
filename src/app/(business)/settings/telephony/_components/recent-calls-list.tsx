'use client'

import { PhoneIncoming, PhoneMissed } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { CrmCallRow } from '@/lib/actions/telephony'

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function RecentCallsList({ calls }: { calls: CrmCallRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Recent calls</CardTitle>
      </CardHeader>
      <CardContent>
        {calls.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No calls yet. Call buttons appear on leads and customers once
            Exotel is connected and your phone number is saved.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {calls.map((call) => {
              const connected = call.status === 'completed' || call.status === 'in-progress'
              return (
                <li key={call.id} className="space-y-2 py-3">
                  <div className="flex items-center gap-3 text-sm">
                    {connected ? (
                      <PhoneIncoming className="size-4 shrink-0 text-success" />
                    ) : (
                      <PhoneMissed className="size-4 shrink-0 text-destructive" />
                    )}
                    <span className="font-mono text-xs">{call.customer_number}</span>
                    <span className="text-xs text-muted-foreground">
                      {call.status}
                      {call.duration_seconds ? ` · ${formatDuration(call.duration_seconds)}` : ''}
                    </span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {new Date(call.created_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {call.recording_url && (
                    <audio
                      controls
                      preload="none"
                      src={`/api/telephony/recording/${call.id}`}
                      className="h-9 w-full"
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
