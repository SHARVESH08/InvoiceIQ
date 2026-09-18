import { z } from 'zod'
import { GSTIN_REGEX } from '@/lib/gstin'

export const CustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  customer_type: z.enum(['b2b', 'b2c']),
  gstin: z
    .string()
    .regex(GSTIN_REGEX, 'Invalid GSTIN format (e.g. 27AAPFU0939F1ZV)')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .regex(/^\d{10}$/, 'Enter a valid 10-digit phone number')
    .optional()
    .or(z.literal('')),
  email: z.string().email('Enter a valid email address').optional().or(z.literal('')),
  state_code: z.string().optional(),
  credit_limit: z.coerce.number().min(0).default(0),
  // Address fields — assembled into billing_address jsonb by Server Action
  billing_street: z.string().optional(),
  billing_city: z.string().optional(),
  billing_pincode: z
    .string()
    .regex(/^\d{6}$/, 'Pincode must be 6 digits')
    .optional()
    .or(z.literal('')),
})

export type CustomerInput = z.infer<typeof CustomerSchema>

/**
 * A B2C customer has no GSTIN by definition, so the forms hide the field for
 * them. This is the server-side half of that rule: it drops any value a
 * B2B→B2C switch (or a hand-rolled request) left behind, so the column can
 * never disagree with customer_type.
 */
export function gstinForCustomerType(
  customerType: CustomerInput['customer_type'],
  gstin: string | undefined
): string | null {
  if (customerType === 'b2c') return null
  return gstin || null
}
