import { z } from 'zod'

export const ProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  hsn_code: z
    .string()
    .regex(/^\d{4,8}$/, 'HSN code must be 4–8 digits')
    .optional()
    .or(z.literal('')),
  unit: z.string().min(1, 'Unit is required'),
  purchase_price: z.coerce.number().min(0, 'Price must be 0 or greater'),
  selling_price: z.coerce.number().min(0, 'Price must be 0 or greater'),
  tax_rate: z.coerce.number().min(0).max(100, 'Select a valid tax rate'),
  reorder_level: z.coerce.number().min(0),
  category: z.string().optional(),
})

export type ProductInput = z.infer<typeof ProductSchema>

// Import schema — maps CSV/Excel column headers to product fields
// All fields optional except name (used for bulk import validation)
export const ProductImportSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  hsn_code: z.string().optional(),
  unit: z.string().optional().default('pcs'),
  purchase_price: z.coerce.number().min(0),
  selling_price: z.coerce.number().min(0),
  tax_rate: z.coerce.number().min(0).max(100),
  reorder_level: z.coerce.number().min(0).default(0),
  category: z.string().optional(),
  description: z.string().optional(),
})

export type ProductImportInput = z.infer<typeof ProductImportSchema>
