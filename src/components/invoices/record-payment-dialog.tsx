'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { PaymentSchema, type PaymentInput } from '@/lib/schemas/invoice'
import { recordPayment } from '@/lib/actions/invoices'

interface RecordPaymentDialogProps {
  invoiceId: string
  invoiceNumber: string | null
  outstandingAmount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RecordPaymentDialog({
  invoiceId,
  invoiceNumber,
  outstandingAmount,
  open,
  onOpenChange,
}: RecordPaymentDialogProps) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const paymentForm = useForm<PaymentInput>({
    resolver: zodResolver(PaymentSchema),
    defaultValues: {
      amount: outstandingAmount,
      payment_mode: 'cash',
      payment_date: today,
      reference_number: '',
    },
  })

  async function handleRecordPayment(values: PaymentInput) {
    const result = await recordPayment(invoiceId, values)
    if (result?.error) {
      paymentForm.setError('root', { message: result.error })
      return
    }
    // recordPayment redirects server-side on success; if we reach here refresh
    router.refresh()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment received for Invoice {invoiceNumber ?? 'Draft'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Amount (₹)</Label>
            <Input
              id="payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              {...paymentForm.register('amount', { valueAsNumber: true })}
            />
            {paymentForm.formState.errors.amount && (
              <p className="text-xs text-destructive">
                {paymentForm.formState.errors.amount.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Outstanding: ₹{outstandingAmount.toFixed(2)}
            </p>
          </div>

          {/* Payment Mode */}
          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <Select
              defaultValue="cash"
              onValueChange={(val) =>
                paymentForm.setValue(
                  'payment_mode',
                  val as PaymentInput['payment_mode']
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
            {paymentForm.formState.errors.payment_mode && (
              <p className="text-xs text-destructive">
                {paymentForm.formState.errors.payment_mode.message}
              </p>
            )}
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label htmlFor="payment-date">Payment Date</Label>
            <Input
              id="payment-date"
              type="date"
              {...paymentForm.register('payment_date')}
            />
          </div>

          {/* Reference Number */}
          <div className="space-y-2">
            <Label htmlFor="payment-ref">
              Reference Number{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="payment-ref"
              placeholder="UTR / Cheque no."
              {...paymentForm.register('reference_number')}
            />
          </div>

          {/* Root form error */}
          {paymentForm.formState.errors.root && (
            <p className="text-sm text-destructive">
              {paymentForm.formState.errors.root.message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={paymentForm.handleSubmit(handleRecordPayment)}
            disabled={paymentForm.formState.isSubmitting}
          >
            {paymentForm.formState.isSubmitting && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
