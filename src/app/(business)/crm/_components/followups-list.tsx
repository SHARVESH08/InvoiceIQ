'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { completeTask, createTask, type CrmTask } from '@/lib/actions/crm'

interface FollowUpsListProps {
  tasks: CrmTask[]
}

/** Groups open tasks into overdue / due today / upcoming, ISO-date compared. */
export function groupTasks(tasks: CrmTask[], todayIso: string) {
  return {
    overdue: tasks.filter((t) => t.due_date < todayIso),
    today: tasks.filter((t) => t.due_date === todayIso),
    upcoming: tasks.filter((t) => t.due_date > todayIso),
  }
}

export function FollowUpsList({ tasks }: FollowUpsListProps) {
  const router = useRouter()
  const todayIso = new Date().toISOString().slice(0, 10)
  const groups = groupTasks(tasks, todayIso)

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <NewTaskDialog onCreated={() => router.refresh()} />
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing to follow up on. Add reminders for calls and collections.
          </p>
        </div>
      ) : (
        <>
          <TaskGroup title="Overdue" tone="destructive" tasks={groups.overdue} />
          <TaskGroup title="Due today" tone="primary" tasks={groups.today} />
          <TaskGroup title="Upcoming" tone="muted" tasks={groups.upcoming} />
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function TaskGroup({
  title,
  tone,
  tasks,
}: {
  title: string
  tone: 'destructive' | 'primary' | 'muted'
  tasks: CrmTask[]
}) {
  if (tasks.length === 0) return null
  const toneClass =
    tone === 'destructive'
      ? 'text-destructive'
      : tone === 'primary'
        ? 'text-primary'
        : 'text-muted-foreground'

  return (
    <section>
      <h3 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${toneClass}`}>
        {title} ({tasks.length})
      </h3>
      <ul className="divide-y divide-border/60 rounded-xl border border-border">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </ul>
    </section>
  )
}

function TaskRow({ task }: { task: CrmTask }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function done() {
    startTransition(async () => {
      const result = await completeTask(task.id)
      if ('error' in result) toast.error(result.error)
      router.refresh()
    })
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button
        type="button"
        onClick={done}
        disabled={isPending}
        aria-label={`Mark "${task.title}" done`}
        className="flex size-5 shrink-0 items-center justify-center rounded-md border border-muted-foreground/50 transition-colors hover:border-primary hover:text-primary cursor-pointer"
      >
        {isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3 opacity-0 hover:opacity-100" />}
      </button>
      <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
        {new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
      </span>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function NewTaskDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createTask({ title, due_date: dueDate })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Follow-up added')
      setOpen(false)
      setTitle('')
      setDueDate('')
      onCreated()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 size-4" /> New follow-up
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New follow-up</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">What needs doing?</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Call Mehta Hardware about the overdue balance"
              required
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={isPending || !title.trim() || !dueDate}
            className="w-full"
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Add follow-up
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
