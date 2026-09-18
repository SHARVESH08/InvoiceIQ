import { listNotifications } from '@/lib/actions/notifications'

import { NotificationList } from './_components/notification-list'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// Notification inbox.
// No permission guard: notifications are owned by the user, not the company
// role, and RLS already scopes rows to the caller.
// ─────────────────────────────────────────────────────────────────────────────

export default async function NotificationsPage() {
  const notifications = await listNotifications()
  const unreadCount = notifications.filter((n) => !n.read_at).length

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          {unreadCount > 0
            ? `${unreadCount} unread`
            : 'You are all caught up.'}
        </p>
      </div>

      <NotificationList notifications={notifications} />
    </div>
  )
}
