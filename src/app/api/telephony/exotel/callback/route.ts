import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { parseCallbackBody, type ExotelCallbackPayload } from '@/lib/telephony/callback'

// ─────────────────────────────────────────────────────────────────────────────
// Exotel StatusCallback receiver.
// Auth: Exotel v1 does not sign webhooks, so the callback URL carries the
// company's webhook_token (generated at settings save); we verify it against
// telephony_settings before touching anything.
// Payload: JSON (we request StatusCallbackContentType=application/json), with
// form-encoded fallback. Terminal events carry Status/RecordingUrl/durations.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company')
  const callId = req.nextUrl.searchParams.get('call')
  const token = req.nextUrl.searchParams.get('token')
  if (!companyId || !callId || !token) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: settings } = await admin
    .from('telephony_settings')
    .select('webhook_token')
    .eq('company_id', companyId)
    .maybeSingle()
  if (!settings || settings.webhook_token !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: ExotelCallbackPayload
  try {
    payload = await parseCallbackBody(req)
  } catch {
    return NextResponse.json({ error: 'Unreadable payload' }, { status: 400 })
  }

  const { data: call } = await admin
    .from('crm_calls')
    .select('id, status, customer_id, lead_id, deal_id, agent_user_id, customer_number, interaction_id')
    .eq('id', callId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!call) {
    return NextResponse.json({ error: 'Unknown call' }, { status: 404 })
  }

  // 'answered' event: flip status only; terminal event does the bookkeeping.
  if (payload.EventType === 'answered') {
    await admin
      .from('crm_calls')
      .update({ status: 'in-progress' })
      .eq('id', call.id)
      .eq('status', 'initiated')
    return NextResponse.json({ ok: true })
  }

  const duration =
    payload.ConversationDuration !== undefined && payload.ConversationDuration !== ''
      ? Number(payload.ConversationDuration)
      : null

  await admin
    .from('crm_calls')
    .update({
      status: payload.Status ?? 'completed',
      duration_seconds: Number.isFinite(duration) ? duration : null,
      recording_url: payload.RecordingUrl ?? null,
      ended_at: payload.EndTime ?? new Date().toISOString(),
    })
    .eq('id', call.id)

  // One timeline entry per call — idempotent across webhook retries.
  if (!call.interaction_id && (call.customer_id || call.lead_id || call.deal_id)) {
    const minutes = duration && Number.isFinite(duration) ? Math.round(duration / 60) : 0
    const summary =
      payload.Status === 'completed'
        ? `Call to ${call.customer_number} (${minutes > 0 ? `${minutes} min` : 'under a minute'}${payload.RecordingUrl ? ', recorded' : ''})`
        : `Call to ${call.customer_number} did not connect (${payload.Status ?? 'failed'})`

    const { data: interaction } = await admin
      .from('crm_interactions')
      .insert({
        company_id: companyId,
        type: 'call',
        content: summary,
        customer_id: call.customer_id,
        lead_id: call.lead_id,
        deal_id: call.deal_id,
        created_by: call.agent_user_id,
      })
      .select('id')
      .single()

    if (interaction) {
      await admin
        .from('crm_calls')
        .update({ interaction_id: interaction.id })
        .eq('id', call.id)
    }
  }

  return NextResponse.json({ ok: true })
}
