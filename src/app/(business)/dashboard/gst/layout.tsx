import { requirePagePermission } from '@/lib/auth/require-permission'

// Role gate for every route in this segment. The sidebar already hides the
// entry for roles without 'gst:read'; this stops the URL being typed directly.
export default async function SectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePagePermission('gst:read')
  return <>{children}</>
}
