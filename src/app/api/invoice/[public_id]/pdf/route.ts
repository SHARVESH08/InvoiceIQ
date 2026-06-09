import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { public_id: string } }) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('invoices')
    .select('pdf_url')
    .eq('public_id', params.public_id)
    .single()

  if (error || !data?.pdf_url) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.redirect(data.pdf_url)
}
