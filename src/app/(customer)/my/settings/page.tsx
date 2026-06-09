import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { NotificationSettings } from './_components/notification-settings'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/customer/login')
  }

  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('email_reminders')
    .eq('user_id', user.id)
    .single()

  const emailReminders = profile?.email_reminders ?? true

  return (
    <div className="space-y-6 max-w-sm">
      <h1 className="text-xl font-bold">Notification Preferences</h1>
      <NotificationSettings emailReminders={emailReminders} />
    </div>
  )
}
