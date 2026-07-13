'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatRupees } from '@/lib/format'
import { createDeal, moveDealStage, type CrmDeal, type CrmLead } from '@/lib/actions/crm'
import { DEAL_STAGES, type DealStage } from '@/lib/crm-constants'

const STAGE_LABELS: Record<DealStage, string> = {
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}

interface PipelineBoardProps {
  deals: CrmDeal[]
  leads: CrmLead[]
}

/**
 * PipelineBoard — kanban by deal stage. Stage moves use accessible
 * previous/next buttons (no drag-and-drop dependency); each move is a server
 * action + router.refresh().
 */
export function PipelineBoard({ deals, leads }: PipelineBoardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [movingId, setMovingId] = useState<string | null>(null)

  function move(deal: CrmDeal, direction: -1 | 1) {
    const idx = DEAL_STAGES.indexOf(deal.stage)
    const next = DEAL_STAGES[idx + direction]
    if (!next) return
    setMovingId(deal.id)
    startTransition(async () => {
      const result = await moveDealStage(deal.id, next)
      if ('error' in result) toast.error(result.error)
      setMovingId(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewDealDialog leads={leads} onCreated={() => router.refresh()} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {DEAL_STAGES.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage)
          const total = stageDeals.reduce((sum, d) => sum + Number(d.value), 0)
          return (
            <div
              key={stage}
              className="flex min-h-40 flex-col rounded-xl border border-border bg-card/40 p-3"
            >
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h3 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h3>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {stageDeals.length} · {formatRupees(total)}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {stageDeals.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                    No deals
                  </p>
                )}
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40"
                  >
                    <p className="text-sm font-medium leading-snug">{deal.title}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono text-xs text-primary">
                        {formatRupees(Number(deal.value))}
                      </span>
                      {deal.expected_close && (
                        <span className="text-[10px] text-muted-foreground">
                          close{' '}
                          {new Date(deal.expected_close).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        aria-label={`Move ${deal.title} to previous stage`}
                        disabled={isPending || DEAL_STAGES.indexOf(deal.stage) === 0}
                        onClick={() => move(deal, -1)}
                      >
                        {movingId === deal.id && isPending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <ChevronLeft className="size-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        aria-label={`Move ${deal.title} to next stage`}
                        disabled={
                          isPending || DEAL_STAGES.indexOf(deal.stage) === DEAL_STAGES.length - 1
                        }
                        onClick={() => move(deal, 1)}
                      >
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function NewDealDialog({ leads, onCreated }: { leads: CrmLead[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')
  const [expectedClose, setExpectedClose] = useState('')
  const [leadId, setLeadId] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  const openLeads = leads.filter((l) => l.status !== 'converted' && l.status !== 'lost')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createDeal({
        title,
        value: Number(value) || 0,
        stage: 'qualified',
        expected_close: expectedClose,
        lead_id: leadId || undefined,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Deal created')
      setOpen(false)
      setTitle('')
      setValue('')
      setExpectedClose('')
      setLeadId('')
      onCreated()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 size-4" /> New deal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deal-title">Title</Label>
            <Input
              id="deal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fleet quote, 6 vehicles"
              required
              maxLength={160}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="deal-value">Value (₹)</Label>
              <Input
                id="deal-value"
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="120000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-close">Expected close</Label>
              <Input
                id="deal-close"
                type="date"
                value={expectedClose}
                onChange={(e) => setExpectedClose(e.target.value)}
              />
            </div>
          </div>
          {openLeads.length > 0 && (
            <div className="space-y-2">
              <Label>Linked lead (optional)</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="No lead" />
                </SelectTrigger>
                <SelectContent>
                  {openLeads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" disabled={isPending || !title.trim()} className="w-full">
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create deal
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
