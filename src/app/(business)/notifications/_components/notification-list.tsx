'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Bell,
  Building2,
  CheckCheck,
  PackageX,
  ShoppingCart,
  CalendarClock,
  Info,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
  type NotificationType,
} from '@/lib/actions/notifications'

const ICONS: Record<NotificationType, LucideIcon> = {
  franchise_invite: Building2,
  franchise_response: Building2,
  low_stock: PackageX,
  po_status: ShoppingCart,
  task_due: CalendarClock,
  system: Info,
}

/** Short relative age — avoids pulling in a date library for one label. */
function timeAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN')
}

export function NotificationList({
  notifications,
}: {
  notifications: AppNotification[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Rendered once per mount rather than per row, so every relative label in a
  // single paint is measured against the same instant.
  const [now] = useState(() => Date.now())

  const hasUnread = notifications.some((n) => !n.read_at)

  function handleMarkAll() {
    startTransition(async () => {
      const result = await markAllNotificationsRead()
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleOpen(notification: AppNotification) {
    if (notification.read_at) return
    // Fire-and-forget: navigation should not wait on the read receipt.
    void markNotificationRead(notification.id).then(() => router.refresh())
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-16">
        <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-base font-semibold">No notifications yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Franchise invites, low stock warnings and purchase order updates will
          appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {hasUnread && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleMarkAll} disabled={isPending}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        </div>
      )}

      <ul className="divide-y rounded-md border">
        {notifications.map((notification) => {
          const Icon = ICONS[notification.type] ?? Info
          const unread = !notification.read_at

          const row = (
            <div
              className={cn(
                'flex gap-3 p-4 transition-colors',
                unread ? 'bg-primary/5' : 'bg-transparent',
                notification.link && 'hover:bg-muted/60'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0 mt-0.5',
                  unread ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className={cn('text-sm', unread ? 'font-semibold' : 'font-medium')}>
                    {notification.title}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(notification.created_at, now)}
                  </span>
                </div>
                {notification.body && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{notification.body}</p>
                )}
              </div>
              {unread && (
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                  aria-label="Unread"
                />
              )}
            </div>
          )

          return (
            <li key={notification.id}>
              {notification.link ? (
                <Link href={notification.link} onClick={() => handleOpen(notification)}>
                  {row}
                </Link>
              ) : (
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => handleOpen(notification)}
                >
                  {row}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
