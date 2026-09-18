import { requirePagePermission } from '@/lib/auth/require-permission'

import { SettingsTabs } from './_components/settings-tabs'

// ─────────────────────────────────────────────────────────────────────────────
// SettingsLayout (server)
// Gates the whole /settings segment on 'settings:read', then renders the client
// tab bar. The guard lives here rather than in SettingsTabs because a client
// component can't run it — and hiding tabs wouldn't stop a direct URL anyway.
// ─────────────────────────────────────────────────────────────────────────────

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePagePermission('settings:read')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <SettingsTabs />
      {children}
    </div>
  )
}
