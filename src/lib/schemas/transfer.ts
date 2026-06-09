import { z } from 'zod'

export const CreateTransferSchema = z
  .object({
    product_id: z.string().uuid('Invalid product'),
    from_godown_id: z.string().uuid('Invalid source godown'),
    to_godown_id: z.string().uuid('Invalid destination godown'),
    qty: z.number().positive('Quantity must be greater than 0'),
    notes: z.string().optional(),
  })
  .refine((data) => data.from_godown_id !== data.to_godown_id, {
    message: 'Source and destination godown must be different',
    path: ['to_godown_id'],
  })

export type CreateTransferInput = z.infer<typeof CreateTransferSchema>
