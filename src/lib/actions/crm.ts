'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const CRM_PATH = '/crm'

type Result = { success: true } | { error: string }

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

import { DEAL_STAGES, type DealStage } from '@/lib/crm-constants'

// NOTE: DealStage/DEAL_STAGES live in @/lib/crm-constants — a 'use server'
// module may only export async functions (even type re-exports break the
// Next action extractor).
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
export type LeadSource = 'walk_in' | 'referral' | 'whatsapp' | 'online' | 'other'
export type InteractionType = 'call' | 'email' | 'whatsapp' | 'visit' | 'note'

export interface CrmLead {
  id: string
  name: string
  phone: string | null
  email: string | null
  source: LeadSource
  status: LeadStatus
  customer_id: string | null
  notes: string | null
  created_at: string
}

export interface CrmDeal {
  id: string
  title: string
  value: number
  stage: DealStage
  expected_close: string | null
  lead_id: string | null
  customer_id: string | null
  created_at: string
  updated_at: string
}

export interface CrmTask {
  id: string
  title: string
  due_date: string
  status: 'open' | 'done'
  customer_id: string | null
  lead_id: string | null
  deal_id: string | null
  created_at: string
}

export interface CrmInteraction {
  id: string
  type: InteractionType
  content: string
  occurred_at: string
}

export interface CrmSegments {
  top_spenders: number
  overdue: number
  at_risk: number
  new_30d: number
}

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
// Leads
// ─────────────────────────────────────────────────────────────────────────────

const LeadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  source: z.enum(['walk_in', 'referral', 'whatsapp', 'online', 'other']),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
})

export type LeadInput = z.infer<typeof LeadSchema>

export async function listLeads(): Promise<CrmLead[]> {
  const c = await ctx()
  if ('error' in c) return []
  const { data } = await c.supabase
    .from('crm_leads')
    .select('id, name, phone, email, source, status, customer_id, notes, created_at')
    .eq('company_id', c.companyId)
    .order('created_at', { ascending: false })
  return (data ?? []) as CrmLead[]
}

export async function createLead(input: LeadInput): Promise<Result> {
  const parsed = LeadSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const c = await ctx()
  if ('error' in c) return c

  const { error } = await c.supabase.from('crm_leads').insert({
    company_id: c.companyId,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    source: parsed.data.source,
    notes: parsed.data.notes || null,
  })
  if (error) return { error: error.message }
  revalidatePath(CRM_PATH)
  return { success: true }
}

export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<Result> {
  if (status === 'converted') {
    return { error: 'Use convertLead to convert a lead' }
  }
  const c = await ctx()
  if ('error' in c) return c

  const { error } = await c.supabase
    .from('crm_leads')
    .update({ status })
    .eq('id', leadId)
    .eq('company_id', c.companyId)
  if (error) return { error: error.message }
  revalidatePath(CRM_PATH)
  return { success: true }
}

/**
 * Converts a lead into a customer (reusing the customers table shape used by
 * add-customer-dialog) and marks the lead converted, linked to the new row.
 */
export async function convertLead(leadId: string): Promise<Result> {
  const c = await ctx()
  if ('error' in c) return c

  const { data: lead, error: leadError } = await c.supabase
    .from('crm_leads')
    .select('id, name, phone, email, status, customer_id')
    .eq('id', leadId)
    .eq('company_id', c.companyId)
    .maybeSingle()
  if (leadError || !lead) return { error: 'Lead not found' }
  if (lead.status === 'converted' || lead.customer_id) {
    return { error: 'Lead is already converted' }
  }

  const { data: customer, error: customerError } = await c.supabase
    .from('customers')
    .insert({
      company_id: c.companyId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      customer_type: 'b2c',
    })
    .select('id')
    .single()
  if (customerError) return { error: customerError.message }

  const { error: updateError } = await c.supabase
    .from('crm_leads')
    .update({ status: 'converted', customer_id: customer.id })
    .eq('id', leadId)
    .eq('company_id', c.companyId)
  if (updateError) {
    // Compensating delete — do not leave an orphan customer if linking failed.
    await c.supabase.from('customers').delete().eq('id', customer.id)
    return { error: updateError.message }
  }

  revalidatePath(CRM_PATH)
  revalidatePath('/customers')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deals
// ─────────────────────────────────────────────────────────────────────────────

const DealSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  value: z.number().min(0, 'Value cannot be negative').max(999999999),
  stage: z.enum(['qualified', 'proposal', 'negotiation', 'won', 'lost']).default('qualified'),
  expected_close: z.string().optional().or(z.literal('')),
  lead_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
})

export type DealInput = z.infer<typeof DealSchema>

export async function listDeals(): Promise<CrmDeal[]> {
  const c = await ctx()
  if ('error' in c) return []
  const { data } = await c.supabase
    .from('crm_deals')
    .select('id, title, value, stage, expected_close, lead_id, customer_id, created_at, updated_at')
    .eq('company_id', c.companyId)
    .order('updated_at', { ascending: false })
  return (data ?? []) as CrmDeal[]
}

export async function createDeal(input: DealInput): Promise<Result> {
  const parsed = DealSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const c = await ctx()
  if ('error' in c) return c

  const { error } = await c.supabase.from('crm_deals').insert({
    company_id: c.companyId,
    title: parsed.data.title,
    value: parsed.data.value,
    stage: parsed.data.stage,
    expected_close: parsed.data.expected_close || null,
    lead_id: parsed.data.lead_id ?? null,
    customer_id: parsed.data.customer_id ?? null,
  })
  if (error) return { error: error.message }
  revalidatePath(CRM_PATH)
  return { success: true }
}

export async function moveDealStage(dealId: string, stage: DealStage): Promise<Result> {
  if (!DEAL_STAGES.includes(stage)) return { error: 'Invalid stage' }

  const c = await ctx()
  if ('error' in c) return c

  const { error } = await c.supabase
    .from('crm_deals')
    .update({ stage })
    .eq('id', dealId)
    .eq('company_id', c.companyId)
  if (error) return { error: error.message }
  revalidatePath(CRM_PATH)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactions
// ─────────────────────────────────────────────────────────────────────────────

const InteractionSchema = z
  .object({
    type: z.enum(['call', 'email', 'whatsapp', 'visit', 'note']).default('note'),
    content: z.string().trim().min(1, 'Content is required').max(4000),
    customer_id: z.string().uuid().optional(),
    lead_id: z.string().uuid().optional(),
    deal_id: z.string().uuid().optional(),
  })
  .refine((v) => v.customer_id || v.lead_id || v.deal_id, {
    message: 'Interaction must be linked to a customer, lead, or deal',
  })

export type InteractionInput = z.infer<typeof InteractionSchema>

export async function logInteraction(input: InteractionInput): Promise<Result> {
  const parsed = InteractionSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const c = await ctx()
  if ('error' in c) return c

  const { error } = await c.supabase.from('crm_interactions').insert({
    company_id: c.companyId,
    type: parsed.data.type,
    content: parsed.data.content,
    customer_id: parsed.data.customer_id ?? null,
    lead_id: parsed.data.lead_id ?? null,
    deal_id: parsed.data.deal_id ?? null,
    created_by: c.userId,
  })
  if (error) return { error: error.message }
  revalidatePath(CRM_PATH)
  return { success: true }
}

export async function listCustomerInteractions(customerId: string): Promise<CrmInteraction[]> {
  const c = await ctx()
  if ('error' in c) return []
  const { data } = await c.supabase
    .from('crm_interactions')
    .select('id, type, content, occurred_at')
    .eq('company_id', c.companyId)
    .eq('customer_id', customerId)
    .order('occurred_at', { ascending: false })
    .limit(50)
  return (data ?? []) as CrmInteraction[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Tasks (follow-ups)
// ─────────────────────────────────────────────────────────────────────────────

const TaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  customer_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
})

export type TaskInput = z.infer<typeof TaskSchema>

export async function listOpenTasks(): Promise<CrmTask[]> {
  const c = await ctx()
  if ('error' in c) return []
  const { data } = await c.supabase
    .from('crm_tasks')
    .select('id, title, due_date, status, customer_id, lead_id, deal_id, created_at')
    .eq('company_id', c.companyId)
    .eq('status', 'open')
    .order('due_date', { ascending: true })
  return (data ?? []) as CrmTask[]
}

export async function createTask(input: TaskInput): Promise<Result> {
  const parsed = TaskSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const c = await ctx()
  if ('error' in c) return c

  const { error } = await c.supabase.from('crm_tasks').insert({
    company_id: c.companyId,
    title: parsed.data.title,
    due_date: parsed.data.due_date,
    customer_id: parsed.data.customer_id ?? null,
    lead_id: parsed.data.lead_id ?? null,
    deal_id: parsed.data.deal_id ?? null,
    created_by: c.userId,
  })
  if (error) return { error: error.message }
  revalidatePath(CRM_PATH)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function completeTask(taskId: string): Promise<Result> {
  const c = await ctx()
  if ('error' in c) return c

  const { error } = await c.supabase
    .from('crm_tasks')
    .update({ status: 'done' })
    .eq('id', taskId)
    .eq('company_id', c.companyId)
  if (error) return { error: error.message }
  revalidatePath(CRM_PATH)
  revalidatePath('/dashboard')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Insights
// ─────────────────────────────────────────────────────────────────────────────

export async function getCrmSegments(): Promise<CrmSegments | null> {
  const c = await ctx()
  if ('error' in c) return null
  const { data, error } = await c.supabase.rpc('get_crm_segments')
  if (error || !data) return null
  return data as CrmSegments
}

/** Lead + deal conversion funnel counts for the Insights tab. */
export async function getCrmFunnel(): Promise<{
  leads_total: number
  leads_converted: number
  deals_won: number
  deals_lost: number
  won_value: number
} | null> {
  const c = await ctx()
  if ('error' in c) return null

  const [leadsRes, dealsRes] = await Promise.all([
    c.supabase
      .from('crm_leads')
      .select('status')
      .eq('company_id', c.companyId),
    c.supabase
      .from('crm_deals')
      .select('stage, value')
      .eq('company_id', c.companyId),
  ])

  const leads = leadsRes.data ?? []
  const deals = dealsRes.data ?? []
  return {
    leads_total: leads.length,
    leads_converted: leads.filter((l) => l.status === 'converted').length,
    deals_won: deals.filter((d) => d.stage === 'won').length,
    deals_lost: deals.filter((d) => d.stage === 'lost').length,
    won_value: deals
      .filter((d) => d.stage === 'won')
      .reduce((sum, d) => sum + Number(d.value ?? 0), 0),
  }
}
