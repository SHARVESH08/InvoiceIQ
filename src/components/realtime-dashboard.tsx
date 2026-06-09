'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────────────────────
// RealtimeDashboard — subscribes to INSERT events on the invoices table filtered
// by company_id, then debounces router.refresh() with a 500ms ref-based timer
// to prevent dashboard jitter on high-frequency invoice creation (T-07-10 /
// 07-REVIEWS.md MEDIUM concern). Renders children unchanged (transparent wrapper).
//
// Cleanup on unmount: clears any pending debounce timer AND calls
// channel.unsubscribe() — React 18 strict-mode double-mount safe (mount →
// cleanup → mount leaves exactly one active subscription).
// ─────────────────────────────────────────────────────────────────────────────

interface RealtimeDashboardProps {
  companyId: string
  children: React.ReactNode
}

export function RealtimeDashboard({ companyId, children }: RealtimeDashboardProps) {
  const router = useRouter()
  // Ref-based debounce handle — avoids stale closure issues with state (07-REVIEWS.md MEDIUM)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channelName = `invoices-realtime-${companyId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        // No server-side filter: column filters on postgres_changes can silently
        // drop the subscription when the Realtime service can't resolve the filter.
        // RLS already scopes events to rows the user can SELECT; we guard with a
        // client-side company_id check in the callback below.
        { event: 'INSERT', schema: 'public', table: 'invoices' },
        (payload) => {
          if (payload.new.company_id !== companyId) return
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = setTimeout(() => {
            router.refresh()
          }, 500)
        },
      )
      .subscribe()

    return () => {
      // Clear any pending debounce timer before unsubscribing
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      channel.unsubscribe()
    }
  }, [companyId, router])

  return <>{children}</>
}
