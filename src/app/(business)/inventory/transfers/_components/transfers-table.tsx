'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeftRight, Loader2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { approveTransfer, rejectTransfer } from '@/lib/actions/transfers'
import type { TransferRow } from '@/lib/actions/transfers'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransferRowWithApprove extends TransferRow {
  can_approve: boolean
}

interface Props {
  pendingTransfers: TransferRowWithApprove[]
  historyTransfers: TransferRow[]
  currentUserId: string
  tab: string
  created: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') {
    return (
      <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/15">
        Pending
      </Badge>
    )
  }
  if (status === 'approved') {
    return (
      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/15">
        Approved
      </Badge>
    )
  }
  return (
    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/15">
      Rejected
    </Badge>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransfersTable({
  pendingTransfers,
  historyTransfers,
  currentUserId,
  tab,
  created,
}: Props) {
  const router = useRouter()
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<TransferRowWithApprove | null>(null)
  const [isPendingReject, startRejectTransition] = useTransition()

  // Toast on arrival after successful creation
  useEffect(() => {
    if (created) {
      toast.success('Transfer request submitted. Awaiting approval.')
      router.replace('/inventory/transfers?tab=pending')
    }
  }, [created, router])

  function switchTab(newTab: string) {
    router.replace(`/inventory/transfers?tab=${newTab}`)
  }

  async function handleApprove(id: string) {
    setApprovingId(id)
    try {
      const result = await approveTransfer(id)
      if ('error' in result) {
        toast.error(result.error, { duration: 6000 })
      } else {
        toast.success('Transfer approved. Stock has been moved.')
      }
    } finally {
      setApprovingId(null)
    }
  }

  function handleRejectConfirm() {
    if (!rejectTarget) return
    const targetId = rejectTarget.id
    startRejectTransition(async () => {
      const result = await rejectTransfer(targetId)
      if ('error' in result) {
        toast.error(result.error, { duration: 6000 })
      } else {
        toast.success('Transfer request rejected.')
      }
      setRejectTarget(null)
    })
  }

  const activeTab = tab === 'history' ? 'history' : 'pending'

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock Transfers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Move stock between godowns with two-user approval
          </p>
        </div>
        <Button asChild>
          <Link href="/inventory/transfers/new">
            <Plus className="h-4 w-4 mr-2" />
            New Transfer
          </Link>
        </Button>
      </div>

      {/* Tab switcher — URL param is source of truth */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => switchTab('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Pending
          {pendingTransfers.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-semibold px-1.5 min-w-[1.25rem] h-5">
              {pendingTransfers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => switchTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          History
        </button>
      </div>

      {/* Pending tab */}
      {activeTab === 'pending' && (
        <>
          {pendingTransfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <ArrowLeftRight className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No pending transfers</p>
              <p className="text-xs mt-1">
                Create a new transfer request to move stock between godowns
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Requested At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTransfers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.product_name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({t.product_unit})
                        </span>
                      </TableCell>
                      <TableCell>{t.from_godown_name}</TableCell>
                      <TableCell>{t.to_godown_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.qty}</TableCell>
                      <TableCell>{t.requester_display}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(t.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.can_approve ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              className="border-green-500/30 text-green-400 hover:bg-green-500/15 h-8"
                              onClick={() => handleApprove(t.id)}
                              disabled={approvingId === t.id}
                            >
                              {approvingId === t.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Approving...
                                </>
                              ) : (
                                'Approve'
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              className="h-8 text-destructive border-destructive hover:bg-destructive/10"
                              onClick={() => setRejectTarget(t)}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Your request
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <>
          {historyTransfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <ArrowLeftRight className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No transfer history</p>
              <p className="text-xs mt-1">Approved and rejected transfers will appear here</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyTransfers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.product_name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({t.product_unit})
                        </span>
                      </TableCell>
                      <TableCell>{t.from_godown_name}</TableCell>
                      <TableCell>{t.to_godown_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.qty}</TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>{t.requester_display}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(t.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Reject AlertDialog */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Transfer Request?</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectTarget && (
                <>
                  This will reject the transfer of{' '}
                  <strong>
                    {rejectTarget.qty} {rejectTarget.product_unit}
                  </strong>{' '}
                  of <strong>{rejectTarget.product_name}</strong> from{' '}
                  <strong>{rejectTarget.from_godown_name}</strong> to{' '}
                  <strong>{rejectTarget.to_godown_name}</strong>. The reserved stock will be
                  released back to the source godown.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPendingReject}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              disabled={isPendingReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPendingReject ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject Transfer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
