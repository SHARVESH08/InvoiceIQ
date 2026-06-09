'use client'

import type { TaxType } from './tax-badge'

interface InvoiceTotals {
  subtotal: number
  discount_amount: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
}

interface InvoiceTotalsFooterProps {
  totals: InvoiceTotals
  taxType: TaxType
}

export function InvoiceTotalsFooter({ totals, taxType }: InvoiceTotalsFooterProps) {
  return (
    <div className="max-w-sm ml-auto space-y-2">
      {/* Subtotal */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span>₹{totals.subtotal.toFixed(2)}</span>
      </div>

      {/* Discount — shown only when any line item has discount > 0 */}
      {totals.discount_amount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Discount</span>
          <span className="text-destructive">−₹{totals.discount_amount.toFixed(2)}</span>
        </div>
      )}

      {/* Taxable Amount */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Taxable Amount</span>
        <span>₹{totals.taxable_amount.toFixed(2)}</span>
      </div>

      {/* CGST + SGST — intra-state only */}
      {taxType === 'intra' && (
        <>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">CGST</span>
            <span>₹{totals.cgst_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">SGST</span>
            <span>₹{totals.sgst_amount.toFixed(2)}</span>
          </div>
        </>
      )}

      {/* IGST — inter-state only */}
      {taxType === 'inter' && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">IGST</span>
          <span>₹{totals.igst_amount.toFixed(2)}</span>
        </div>
      )}

      {/* Collapsed Tax row when no customer yet and any tax exists */}
      {taxType === 'unknown' && (totals.cgst_amount > 0 || totals.igst_amount > 0) && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax</span>
          <span>₹{(totals.cgst_amount + totals.sgst_amount + totals.igst_amount).toFixed(2)}</span>
        </div>
      )}

      {/* Divider + Total */}
      <div className="border-t pt-2">
        <div className="flex justify-between font-bold text-base">
          <span>Total</span>
          <span>₹{totals.total_amount.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
