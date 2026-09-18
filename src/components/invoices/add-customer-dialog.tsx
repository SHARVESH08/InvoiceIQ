'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { quickCreateCustomer } from '@/lib/actions/customers'

export interface NewCustomer {
  id: string
  name: string
  gstin: string | null
  state_code: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// AddCustomerDialog — inline "create a customer" without leaving the invoice form.
// Calls quickCreateCustomer (which returns the row instead of redirecting), then
// hands the new customer back via onCreated so the caller can select it.
// ─────────────────────────────────────────────────────────────────────────────
export function AddCustomerDialog({
  onCreated,
}: {
  onCreated: (customer: NewCustomer) => void
}) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [customerType, setCustomerType] = useState<'b2b' | 'b2c'>('b2b')
  const [gstin, setGstin] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  function reset() {
    setName('')
    setCustomerType('b2b')
    setGstin('')
    setStateCode('')
    setPhone('')
    setEmail('')
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error('Customer name is required')
      return
    }
    setSubmitting(true)
    const result = await quickCreateCustomer({
      name: name.trim(),
      customer_type: customerType,
      gstin: gstin.trim() || '',
      state_code: stateCode.trim() || undefined,
      phone: phone.trim() || '',
      email: email.trim() || '',
      credit_limit: 0,
    })
    setSubmitting(false)

    if ('error' in result) {
      toast.error(result.error, { duration: 6000 })
      return
    }

    toast.success(`"${result.customer.name}" added`)
    onCreated(result.customer)
    reset()
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Add new customer">
          <UserPlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
          <DialogDescription>
            Create a customer without leaving the invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qc-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="qc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={customerType}
                onValueChange={(v) => {
                  const next = v as 'b2b' | 'b2c'
                  setCustomerType(next)
                  // B2C has no GSTIN — hide the field and drop anything typed.
                  if (next === 'b2c') setGstin('')
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b2b">B2B (GST)</SelectItem>
                  <SelectItem value="b2c">B2C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-state">State code</Label>
              <Input
                id="qc-state"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="e.g. 33"
                inputMode="numeric"
                maxLength={2}
              />
            </div>
          </div>

          {customerType === 'b2b' && (
            <div className="space-y-1.5">
              <Label htmlFor="qc-gstin">GSTIN</Label>
              <Input
                id="qc-gstin"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="27AAPFU0939F1ZV"
                maxLength={15}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qc-phone">Phone</Label>
              <Input
                id="qc-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10 digits"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-email">Email</Label>
              <Input
                id="qc-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                type="email"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {customerType === 'b2b'
              ? 'State code / GSTIN drive CGST+SGST vs IGST.'
              : 'State code drives CGST+SGST vs IGST.'}{' '}
            You can fill in full details later under Customers.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false)
              reset()
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              'Add Customer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
