import { z } from 'zod'

export const SetStockLevelSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  godown_id: z.string().uuid('Invalid godown ID'),
  quantity: z.number().int().min(0, 'Quantity must be 0 or greater'),
  reorder_level: z.number().int().min(0, 'Reorder level must be 0 or greater'),
})

export type SetStockLevelInput = z.infer<typeof SetStockLevelSchema>
