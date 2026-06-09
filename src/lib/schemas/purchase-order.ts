import { z } from 'zod'

export const POLineItemSchema = z.object({
  product_id: z.string().uuid('Product ID must be a valid UUID'),
  quantity_ordered: z.number().positive('Quantity must be greater than 0'),
  unit_price: z.number().min(0, 'Unit price cannot be negative'),
  description: z.string().optional(),
})

export type POLineItemInput = z.infer<typeof POLineItemSchema>

export const CreatePOSchema = z.object({
  distributor_company_id: z.string().uuid('Distributor company ID required'),
  expected_delivery: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(POLineItemSchema).min(1, 'At least one line item required'),
})

export type CreatePOInput = z.infer<typeof CreatePOSchema>

export const UpdatePOStatusSchema = z.object({
  po_id: z.string().uuid('PO ID must be a valid UUID'),
  rejection_reason: z.string().optional(),
})

export type UpdatePOStatusInput = z.infer<typeof UpdatePOStatusSchema>
