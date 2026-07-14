import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchRecording } from '@/lib/telephony/exotel'

// ─────────────────────────────────────────────────────────────────────────────
// Recording proxy. Exotel recording URLs require the account's basic-auth
// credentials, which must never reach the browser. Access control:
//   1. caller must be authenticated,
//   2. the call row must be visible to them under crm_calls RLS
//      (company_isolation) — queried with the USER client on purpose.
// Only then do we stream the audio using the admin-read credentials.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RLS-scoped read: returns null unless the call belongs to the caller's company.
  const { data: call } = await supabase
    .from('crm_calls')
    .select('id, company_id, recording_url')
    .eq('id', callId)
    .maybeSingle()
  if (!call) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!call.recording_url) {
    return NextResponse.json({ error: 'No recording for this call' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('telephony_settings')
    .select('account_sid, api_key, api_token')
    .eq('company_id', call.company_id)
    .maybeSingle()
  if (!settings) {
    return NextResponse.json({ error: 'Telephony not configured' }, { status: 409 })
  }

  const upstream = await fetchRecording(
    {
      accountSid: settings.account_sid,
      apiKey: settings.api_key,
      apiToken: settings.api_token,
    },
    call.recording_url
  )
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Recording unavailable' }, { status: 502 })
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'audio/mpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
