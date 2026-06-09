'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const Schema = z.object({ email_reminders: z.boolean() })

export async function updateEmailReminders(
  input: z.infer<typeof Schema>
): Promise<{ error: string } | { success: true }> {
  const parsed = Schema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('customer_profiles')
    .update({ email_reminders: parsed.data.email_reminders })
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/my/settings')
  return { success: true }
}
