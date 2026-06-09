import { z } from 'zod'

export const GodownSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  address: z.string().optional(),
})

export type GodownInput = z.infer<typeof GodownSchema>
