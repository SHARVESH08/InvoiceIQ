'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Plus, Warehouse } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

import { GodownSchema, type GodownInput } from '@/lib/schemas/godown'
import {
  createGodown,
  updateGodown,
  deactivateGodown,
} from '@/lib/actions/godowns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GodownRow {
  id: string
  name: string
  address: string | null
  is_default: boolean
  is_active: boolean
  company_id: string
}

interface GodownsTableProps {
  godowns: GodownRow[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GodownsTable({ godowns }: GodownsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGodown, setEditingGodown] = useState<GodownRow | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Deactivate AlertDialog state
  const [deactivateTarget, setDeactivateTarget] = useState<GodownRow | null>(null)
  const [isDeactivating, setIsDeactivating] = useState(false)

  // ── Toast-on-arrival effect ──────────────────────────────────────────────
  useEffect(() => {
    const created = searchParams.get('created')
    const updated = searchParams.get('updated')
    const deactivated = searchParams.get('deactivated')

    if (created === '1') {
      toast.success('Godown created.')
      router.replace('/settings/godowns')
    } else if (updated === '1') {
      toast.success('Godown updated.')
      router.replace('/settings/godowns')
    } else if (deactivated === '1') {
      toast.success('Godown deactivated.')
      router.replace('/settings/godowns')
    }
  }, [searchParams, router])

  // ── Form ─────────────────────────────────────────────────────────────────
  const form = useForm<GodownInput>({
    resolver: zodResolver(GodownSchema),
    defaultValues: { name: '', address: '' },
  })

  function openCreate() {
    setEditingGodown(null)
    form.reset({ name: '', address: '' })
    setDialogOpen(true)
  }

  function openEdit(g: GodownRow) {
    setEditingGodown(g)
    form.reset({ name: g.name, address: g.address ?? '' })
    setDialogOpen(true)
  }

  async function onSubmit(data: GodownInput) {
    setIsSubmitting(true)
    try {
      const result = editingGodown
        ? await updateGodown(editingGodown.id, data)
        : await createGodown(data)

      // If result is returned (not redirected), it's an error
      if (result && 'error' in result) {
        toast.error(result.error, { duration: 6000 })
        setIsSubmitting(false)
      }
      // On success the server action redirects — no explicit close needed
    } catch {
      // Server action redirect throws NEXT_REDIRECT — treat as success
      setDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Deactivate handler ───────────────────────────────────────────────────
  async function handleDeactivate() {
    if (!deactivateTarget) return
    setIsDeactivating(true)
    try {
      const result = await deactivateGodown(deactivateTarget.id)
      if (result && 'error' in result) {
        toast.error(result.error, { duration: 6000 })
        setDeactivateTarget(null)
        setIsDeactivating(false)
      }
      // On success the server action redirects
    } catch {
      // NEXT_REDIRECT — success path
      setDeactivateTarget(null)
    } finally {
      setIsDeactivating(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Godowns</h1>
          <p className="text-sm text-muted-foreground">Manage warehouse locations</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Godown
        </Button>
      </div>

      {/* ── Godowns table ────────────────────────────────────────────── */}
      {godowns.length === 0 ? (
        <div className="text-center py-12">
          <Warehouse className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-base font-semibold">No godowns found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first godown to start tracking stock by location.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {godowns.map((g) => (
              <TableRow key={g.id} className={!g.is_active ? 'opacity-50' : ''}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {g.address || '—'}
                </TableCell>
                <TableCell>
                  {g.is_default && (
                    <Badge variant="outline" className="text-xs">
                      Default
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      g.is_active
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }
                  >
                    {g.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(g)}
                      disabled={!g.is_active}
                    >
                      Edit
                    </Button>
                    {/* Deactivate: only for active, non-default godowns */}
                    {!g.is_default && g.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeactivateTarget(g)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* ── Add / Edit Dialog ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingGodown ? 'Edit Godown' : 'Add Godown'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Main Warehouse, North Depot"
                        maxLength={100}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Street, city, pin code"
                        rows={2}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {editingGodown ? 'Saving…' : 'Creating…'}
                    </>
                  ) : editingGodown ? (
                    'Save Changes'
                  ) : (
                    'Create Godown'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate AlertDialog ───────────────────────────────────── */}
      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate &quot;{deactivateTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This godown will be hidden from all operations. Existing inventory
              records are preserved. You can reactivate it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeactivate}
              disabled={isDeactivating}
            >
              {isDeactivating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deactivating…
                </>
              ) : (
                'Deactivate'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
