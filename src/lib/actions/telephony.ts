'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { connectCall, normalizePhone } from '@/lib/telephony/exotel'

type Result = { success: true } | { error: string }

const SETTINGS_PATH = '/settings/telephony'

// ─────────────────────────────────────────────────────────────────────────────
// Auth context (explicit union — see pricing-monitor.ts for why)
// ─────────────────────────────────────────────────────────────────────────────

type Ctx =
  | { error: string }
  | { supabase: Awaited<ReturnType<typeof createClient>>; companyId: string; userId: string }

async function ctx(): Promise<Ctx> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) return { error: 'No company found' }
  return { supabase, companyId: companyId as string, userId: user.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

const SettingsSchema = z.object({
  account_sid: z.string().trim().min(3, 'Account SID is required').max(120),
  api_key: z.string().trim().min(3, 'API key is required').max(200),
  api_token: z.string().trim().min(3, 'API token is required').max(200),
  virtual_number: z.string().trim().min(8, 'Virtual number is required').max(16),
  record_calls: z.boolean().default(true),
})

export type TelephonySettingsInput = z.infer<typeof SettingsSchema>

export interface TelephonyStatus {
  configured: boolean
  virtual_number: string | null
  record_calls: boolean
  /** Masked identifier so the settings form can show what is stored. */
  account_sid_masked: string | null
  agent_phone: string | null
}

/** Settings state for the current user — secrets never leave the server. */
export async function getTelephonyStatus(): Promise<TelephonyStatus> {
  const c = await ctx()
  if ('error' in c) {
    return {
      configured: false,
      virtual_number: null,
      record_calls: true,
      account_sid_masked: null,
      agent_phone: null,
    }
  }

  const [settingsRes, agentRes] = await Promise.all([
    c.supabase
      .from('telephony_settings')
      .select('account_sid, virtual_number, record_calls')
      .eq('company_id', c.companyId)
      .maybeSingle(),
    c.supabase
      .from('telephony_agents')
      .select('phone')
      .eq('company_id', c.companyId)
      .eq('user_id', c.userId)
      .maybeSingle(),
  ])

  const settings = settingsRes.data
  return {
    configured: Boolean(settings),
    virtual_number: settings?.virtual_number ?? null,
    record_calls: settings?.record_calls ?? true,
    account_sid_masked: settings
      ? `${String(settings.account_sid).slice(0, 4)}…`
      : null,
    agent_phone: agentRes.data?.phone ?? null,
  }
}

/** Admin-only via RLS on telephony_settings. */
export async function saveTelephonySettings(input: TelephonySettingsInput): Promise<Result> {
  const parsed = SettingsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const c = await ctx()
  if ('error' in c) return c

  const { error } = await c.supabase.from('telephony_settings').upsert(
    {
      company_id: c.companyId,
      provider: 'exotel',
      account_sid: parsed.data.account_sid,
      api_key: parsed.data.api_key,
      api_token: parsed.data.api_token,
      virtual_number: normalizePhone(parsed.data.virtual_number),
      record_calls: parsed.data.record_calls,
    },
    { onConflict: 'company_id' }
  )
  if (error) {
    // RLS WITH CHECK failure surfaces as a generic error — translate it.
    return { error: 'Only company admins can change telephony settings' }
  }
  revalidatePath(SETTINGS_PATH)
  return { success: true }
}

const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s\-()]{8,16}$/, 'Enter a valid phone number')

export async function saveAgentPhone(phone: string): Promise<Result> {
  const parsed = PhoneSchema.safeParse(phone)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid phone' }

  const c = await ctx()
  if ('error' in c) return c

  const { error } = await c.supabase.from('telephony_agents').upsert(
    {
      company_id: c.companyId,
      user_id: c.userId,
      phone: normalizePhone(parsed.data),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,user_id' }
  )
  if (error) return { error: error.message }
  revalidatePath(SETTINGS_PATH)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calling
// ─────────────────────────────────────────────────────────────────────────────

const InitiateSchema = z
  .object({
    to_number: z.string().trim().min(8, 'No phone number on this record').max(20),
    customer_id: z.string().uuid().optional(),
    lead_id: z.string().uuid().optional(),
    deal_id: z.string().uuid().optional(),
  })
  .refine((v) => v.customer_id || v.lead_id || v.deal_id, {
    message: 'Call must be linked to a customer, lead, or deal',
  })

export type InitiateCallInput = z.infer<typeof InitiateSchema>

export async function initiateCall(
  input: InitiateCallInput
): Promise<{ success: true; call_id: string } | { error: string }> {
  const parsed = InitiateSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const c = await ctx()
  if ('error' in c) return c

  // Secrets read via the admin client: RLS restricts telephony_settings to
  // admins, but salespeople must be able to place calls too. The company scope
  // comes from the caller's own JWT-derived companyId.
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  const [settingsRes, agentRes] = await Promise.all([
    admin
      .from('telephony_settings')
      .select('account_sid, api_key, api_token, virtual_number, webhook_token, record_calls')
      .eq('company_id', c.companyId)
      .maybeSingle(),
    admin
      .from('telephony_agents')
      .select('phone')
      .eq('company_id', c.companyId)
      .eq('user_id', c.userId)
      .maybeSingle(),
  ])

  const settings = settingsRes.data
  if (!settings) {
    return { error: 'Telephony is not set up. Ask an admin to add Exotel credentials in Settings.' }
  }
  const agentPhone = agentRes.data?.phone
  if (!agentPhone) {
    return { error: 'Add your phone number in Settings > Telephony first — Exotel rings you before the customer.' }
  }

  // Log the call first so the webhook (which can arrive fast) has a row to hit.
  const { data: callRow, error: insertError } = await c.supabase
    .from('crm_calls')
    .insert({
      company_id: c.companyId,
      provider: 'exotel',
      agent_user_id: c.userId,
      agent_number: agentPhone,
      customer_number: normalizePhone(parsed.data.to_number),
      customer_id: parsed.data.customer_id ?? null,
      lead_id: parsed.data.lead_id ?? null,
      deal_id: parsed.data.deal_id ?? null,
      status: 'initiated',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (insertError) return { error: insertError.message }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const callbackUrl =
    `${siteUrl}/api/telephony/exotel/callback` +
    `?company=${c.companyId}&call=${callRow.id}&token=${settings.webhook_token}`

  try {
    const result = await connectCall({
      credentials: {
        accountSid: settings.account_sid,
        apiKey: settings.api_key,
        apiToken: settings.api_token,
      },
      from: agentPhone,
      to: parsed.data.to_number,
      callerId: settings.virtual_number,
      record: settings.record_calls,
      statusCallbackUrl: callbackUrl,
    })

    await c.supabase
      .from('crm_calls')
      .update({ provider_call_sid: result.sid })
      .eq('id', callRow.id)
      .eq('company_id', c.companyId)

    return { success: true, call_id: callRow.id }
  } catch (err) {
    await c.supabase
      .from('crm_calls')
      .update({ status: 'failed', ended_at: new Date().toISOString() })
      .eq('id', callRow.id)
      .eq('company_id', c.companyId)
    console.error('[telephony] connectCall failed:', err)
    return { error: 'Could not place the call. Check the Exotel credentials and try again.' }
  }
}

export interface CrmCallRow {
  id: string
  status: string
  duration_seconds: number | null
  recording_url: string | null
  customer_number: string
  created_at: string
}

export async function listRecentCalls(limit = 20): Promise<CrmCallRow[]> {
  const c = await ctx()
  if ('error' in c) return []
  const { data } = await c.supabase
    .from('crm_calls')
    .select('id, status, duration_seconds, recording_url, customer_number, created_at')
    .eq('company_id', c.companyId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as CrmCallRow[]
}
