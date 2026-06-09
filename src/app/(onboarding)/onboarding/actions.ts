'use server'

import { createClient } from '@/lib/supabase/server'

export async function saveOnboardingStep(
  step: number
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId, error: rpcError } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: rpcError?.message ?? 'Company membership not found' }
  }

  const { error } = await supabase
    .from('companies')
    .update({ onboarding_step: step })
    .eq('id', companyId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function completeOnboarding(): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId, error: rpcError } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: rpcError?.message ?? 'Company membership not found' }
  }

  const { error } = await supabase
    .from('companies')
    .update({ onboarding_step: 4, onboarding_completed: true })
    .eq('id', companyId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
