import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { NotificationSettings } from './_components/notification-settings'
import { ProfileSettings } from './_components/profile-settings'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/customer/login')
  }

  // maybeSingle, not single: a profile row is created at registration, but a
  // missing one shouldn't 500 the whole settings page.
  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('email_reminders, phone, email')
    .eq('user_id', user.id)
    .maybeSingle()

  const emailReminders = profile?.email_reminders ?? true
  const fullName =
    (user.user_metadata as Record<string, unknown> | undefined)?.full_name as
      | string
      | undefined

  return (
    <div className="space-y-6 max-w-sm">
      <h1 className="text-xl font-bold">Settings</h1>

      <ProfileSettings
        fullName={fullName ?? ''}
        phone={profile?.phone ?? ''}
        email={profile?.email ?? user.email ?? ''}
      />

      <NotificationSettings emailReminders={emailReminders} />
    </div>
  )
}
