'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { ProductImportSchema, ProductSchema } from '@/lib/schemas/product'

// ─────────────────────────────────────────────────────────────────────────────
// createProduct
// Validates input, resolves company_id server-side via company_users join,
// inserts the product row, and redirects to /products?created=1.
// company_id is NEVER accepted from the client — RLS + explicit join enforces it.
// ─────────────────────────────────────────────────────────────────────────────
export async function createProduct(
  input: z.infer<typeof ProductSchema>
): Promise<{ error: string } | never> {
  const parsed = ProductSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: 'Company membership not found' }
  }

  const { error: insertError } = await supabase.from('products').insert({
    ...parsed.data,
    company_id: companyId,
  })

  if (insertError) {
    if (insertError.code === '23505') return { error: 'A product with this name already exists.' }
    return { error: insertError.message }
  }

  redirect('/products?created=1')
}

// ─────────────────────────────────────────────────────────────────────────────
// updateProduct
// RLS scopes the update to the current company's rows automatically.
// No explicit company_id filter needed — RLS with CHECK enforces it.
// ─────────────────────────────────────────────────────────────────────────────
export async function updateProduct(
  id: string,
  input: z.infer<typeof ProductSchema>
): Promise<{ error: string } | never> {
  const parsed = ProductSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: 'Company membership not found' }
  }

  const { error: updateError } = await supabase
    .from('products')
    .update(parsed.data)
    .eq('id', id)

  if (updateError) {
    if (updateError.code === '23505') return { error: 'A product with this name already exists.' }
    return { error: updateError.message }
  }

  redirect('/products?updated=1')
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteProduct
// RLS DELETE policy scopes delete to current company — cross-company delete
// silently no-ops (Supabase returns 0 rows affected, no error).
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteProduct(
  id: string
): Promise<{ error: string } | void> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (deleteError) return { error: deleteError.message }

  redirect('/products?deleted=1')
}

// ─────────────────────────────────────────────────────────────────────────────
// importProducts
// Receives pre-parsed rows from the client-side bulk import page.
// Re-validates ALL rows server-side with Zod before any DB insert.
// Enforces 500-row batch limit. Redirects to /products?imported=N on success.
//
// Security mitigations:
//   T-03-17 — Server-side re-validation catches tampered rows that bypass client preview
//   T-03-18 — 500-row hard limit prevents DoS via oversized uploads
//   T-03-19 — company_id is resolved server-side from company_users; any company_id
//             field in the row data is stripped by ProductImportSchema (not in schema)
//
// CRITICAL: Do NOT import xlsx or papaparse here. This function receives plain JS
//           objects only — SheetJS/PapaParse run in the 'use client' import page.
// ─────────────────────────────────────────────────────────────────────────────
export async function importProducts(
  rows: z.infer<typeof ProductImportSchema>[]
): Promise<{ error: string; imported?: number } | never> {
  if (rows.length === 0) {
    return { error: 'No valid rows to import' }
  }

  if (rows.length > 500) {
    return { error: 'Maximum 500 rows per import' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: 'Company membership not found' }
  }

  // Server-side re-validation — even though client pre-validated, rows cross a
  // trust boundary and must be validated again (T-03-17).
  const validationResults = rows.map((row) =>
    ProductImportSchema.safeParse(row)
  )
  const failures = validationResults.filter((r) => !r.success)
  if (failures.length > 0) {
    return {
      error:
        'Invalid rows detected server-side — please re-upload and try again',
    }
  }

  const toInsert = validationResults
    .filter((r) => r.success)
    .map((r) => ({
      ...(r as { success: true; data: z.infer<typeof ProductImportSchema> })
        .data,
      company_id: companyId,
    }))

  const { error: insertError } = await supabase
    .from('products')
    .insert(toInsert)

  if (insertError) return { error: insertError.message }

  redirect('/products?imported=' + toInsert.length)
}
