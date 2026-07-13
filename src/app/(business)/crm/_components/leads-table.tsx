'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, UserCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  createLead,
  updateLeadStatus,
  convertLead,
  type CrmLead,
  type LeadStatus,
  type LeadSource,
} from '@/lib/actions/crm'
import { CallButton } from '@/components/telephony/call-button'

const SOURCE_LABELS: Record<LeadSource, string> = {
  walk_in: 'Walk-in',
  referral: 'Referral',
  whatsapp: 'WhatsApp',
  online: 'Online',
  other: 'Other',
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost: 'Lost',
}

// Statuses an open lead can be manually moved to (converted goes via convertLead).
const MANUAL_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'lost']

interface LeadsTableProps {
  leads: CrmLead[]
}

export function LeadsTable({ leads }: LeadsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function setStatus(lead: CrmLead, status: LeadStatus) {
    setBusyId(lead.id)
    startTransition(async () => {
      const result = await updateLeadStatus(lead.id, status)
      if ('error' in result) toast.error(result.error)
      setBusyId(null)
      router.refresh()
    })
  }

  function convert(lead: CrmLead) {
    setBusyId(lead.id)
    startTransition(async () => {
      const result = await convertLead(lead.id)
      if ('error' in result) toast.error(result.error)
      else toast.success(`${lead.name} is now a customer`)
      setBusyId(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewLeadDialog onCreated={() => router.refresh()} />
      </div>

      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No leads yet. Add walk-ins, referrals and WhatsApp enquiries here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-36 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const closed = lead.status === 'converted' || lead.status === 'lost'
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.phone || lead.email || '-'}
                    </TableCell>
                    <TableCell className="text-xs">{SOURCE_LABELS[lead.source]}</TableCell>
                    <TableCell>
                      {closed ? (
                        <Badge variant={lead.status === 'converted' ? 'default' : 'secondary'}>
                          {STATUS_LABELS[lead.status]}
                        </Badge>
                      ) : (
                        <Select
                          value={lead.status}
                          onValueChange={(v) => setStatus(lead, v as LeadStatus)}
                          disabled={isPending && busyId === lead.id}
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MANUAL_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <CallButton toNumber={lead.phone} leadId={lead.id} compact />
                        {!closed && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            disabled={isPending && busyId === lead.id}
                            onClick={() => convert(lead)}
                          >
                            {isPending && busyId === lead.id ? (
                              <Loader2 className="mr-1 size-3 animate-spin" />
                            ) : (
                              <UserCheck className="mr-1 size-3" />
                            )}
                            Convert
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function NewLeadDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState<LeadSource>('walk_in')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createLead({ name, phone, email, source, notes })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Lead added')
      setOpen(false)
      setName('')
      setPhone('')
      setEmail('')
      setSource('walk_in')
      setNotes('')
      onCreated()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 size-4" /> New lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lead-name">Name</Label>
            <Input
              id="lead-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-notes">Notes</Label>
            <Input
              id="lead-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Asked about bulk pricing"
              maxLength={2000}
            />
          </div>
          <Button type="submit" disabled={isPending || !name.trim()} className="w-full">
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Add lead
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
