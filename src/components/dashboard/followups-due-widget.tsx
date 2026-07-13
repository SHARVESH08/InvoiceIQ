import Link from 'next/link'
import { ArrowRight, CalendarClock } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { listOpenTasks } from '@/lib/actions/crm'

// ─────────────────────────────────────────────────────────────────────────────
// FollowUpsDueWidget — server component. Shows CRM follow-ups that are overdue
// or due today; renders nothing when there is nothing actionable.
// ─────────────────────────────────────────────────────────────────────────────

export async function FollowUpsDueWidget() {
  let tasks: Awaited<ReturnType<typeof listOpenTasks>> = []
  try {
    tasks = await listOpenTasks()
  } catch {
    return null // CRM unavailable must never break the dashboard
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const due = tasks.filter((t) => t.due_date <= todayIso)
  if (due.length === 0) return null

  const overdueCount = due.filter((t) => t.due_date < todayIso).length

  return (
    <Card className="mb-6 border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="size-4 text-primary" />
          Follow-ups due
          <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            {due.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/60">
          {due.slice(0, 4).map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate">{task.title}</span>
              <span
                className={`shrink-0 font-mono text-[11px] ${
                  task.due_date < todayIso ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                {task.due_date < todayIso ? 'overdue' : 'today'}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/crm"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {overdueCount > 0
            ? `Open CRM (${overdueCount} overdue)`
            : 'Open CRM'}
          <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  )
}
