import { z } from 'zod'

export const LineItemSchema = z.object({
  product_id: z.string().optional().default(''),
  description: z.string().min(1, 'Description is required'),
  hsn_code: z.string().optional().default(''),
  qty: z.number().gt(0, 'Quantity must be greater than 0'),
  rate: z.number().min(0),
  discount_percent: z.number().min(0).max(100, 'Discount cannot exceed 100%'),
  tax_rate: z.number().min(0),
})

export const InvoiceSchema = z
  .object({
    doc_type: z.enum(['sale', 'purchase', 'credit_note', 'debit_note']),
    customer_id: z.string().optional(),
    supplier_id: z.string().optional(),
    invoice_date: z.string(),
    due_date: z.string().optional(),
    status: z.enum(['draft', 'sent']),
    line_items: z.array(LineItemSchema).min(1, 'At least one line item required'),
    notes: z.string().optional(),
    reference_invoice_id: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (['sale', 'credit_note', 'debit_note'].includes(data.doc_type)) {
      if (!data.customer_id) {
        ctx.addIssue({
          code: 'custom',
          message: 'Customer required for this invoice type',
          path: ['customer_id'],
        })
      }
    }
    if (data.doc_type === 'purchase') {
      if (!data.supplier_id) {
        ctx.addIssue({
          code: 'custom',
          message: 'Supplier required for purchase invoices',
          path: ['supplier_id'],
        })
      }
    }
  })

export const PaymentSchema = z.object({
  amount: z.number().positive(),
  payment_mode: z.enum(['cash', 'bank_transfer', 'cheque', 'upi', 'card', 'other']),
  payment_date: z.string(),
  reference_number: z.string().optional(),
})

export type InvoiceInput = z.infer<typeof InvoiceSchema>
export type PaymentInput = z.infer<typeof PaymentSchema>
