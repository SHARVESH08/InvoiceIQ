import { z } from 'zod'
import { GSTIN_REGEX } from '@/lib/gstin'

export const SupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  gstin: z.string().regex(GSTIN_REGEX, 'Invalid GSTIN format').optional().or(z.literal('')),
  phone: z
    .string()
    .regex(/^\d{10}$/, 'Enter a valid 10-digit phone number')
    .optional()
    .or(z.literal('')),
  email: z.string().email('Enter a valid email address').optional().or(z.literal('')),
  state_code: z.string().optional(),
  // Address fields — assembled into address jsonb by Server Action
  street: z.string().optional(),
  city: z.string().optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, 'Pincode must be 6 digits')
    .optional()
    .or(z.literal('')),
})

export type SupplierInput = z.infer<typeof SupplierSchema>
