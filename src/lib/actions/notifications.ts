'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Notification inbox (migration 041)
//
// Reads are scoped by RLS to the caller's own rows, so none of these carry a
// requirePermission() guard: a notification belongs to a person, not to a role.
// There is no create action on purpose — notifications are written server-side
// by SECURITY DEFINER functions and triggers, never by a client call.
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'franchise_invite'
  | 'franchise_response'
  | 'low_stock'
  | 'po_status'
  | 'task_due'
  | 'system'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

const INBOX_LIMIT = 100

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_unread_notification_count')
  if (error) return 0
  return Number(data ?? 0)
}

export async function listNotifications(): Promise<AppNotification[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(INBOX_LIMIT)

  if (error) return []
  return (data ?? []) as AppNotification[]
}

type Result = { success: true } | { error: string }

export async function markNotificationRead(id: string): Promise<Result> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // RLS restricts this to the caller's rows; the user_id filter makes a policy
  // change fail closed rather than widening the update.
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('read_at', null)

  if (error) return { error: error.message }

  revalidatePath('/notifications')
  return { success: true }
}

export async function markAllNotificationsRead(): Promise<Result> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (error) return { error: error.message }

  revalidatePath('/notifications')
  return { success: true }
}
