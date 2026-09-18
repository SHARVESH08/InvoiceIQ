import { redirect } from 'next/navigation'

// The Settings nav entry points at /settings; land the user on the first tab.
export default function SettingsIndexPage() {
  redirect('/settings/godowns')
}
