import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Uploads a PDF buffer to the private 'invoices' bucket and returns a 1-year signed URL.
 *
 * @param supabase - Authenticated Supabase client
 * @param buffer - PDF buffer to upload
 * @param invoiceId - Invoice UUID used as filename
 * @returns Signed URL valid for 1 year
 * @throws If upload or signed URL generation fails
 */
export async function uploadPdfToStorage(
  supabase: SupabaseClient,
  buffer: Buffer,
  invoiceId: string,
): Promise<string> {
  const path = `invoices/${invoiceId}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data, error: urlError } = await supabase.storage
    .from('invoices')
    .createSignedUrl(path, 60 * 60 * 24 * 365)

  if (urlError || !data?.signedUrl) {
    throw new Error(urlError?.message ?? 'Failed to get signed URL')
  }

  return data.signedUrl
}
