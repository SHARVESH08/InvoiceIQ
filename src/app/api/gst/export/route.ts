export const runtime = 'nodejs'

import { createClient } from '@/lib/supabase/server'
import { buildGstnJson, buildGstnExcel } from '@/lib/gst/gstn-export'
import type { GstnMeta } from '@/lib/gst/gstn-export'

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'json'
  const type = searchParams.get('type') ?? 'GSTR-1'
  const fy = searchParams.get('fy') ?? ''
  const period = searchParams.get('period') ?? ''

  if (format !== 'json' && format !== 'excel') {
    return Response.json({ error: 'format must be "json" or "excel"' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: periodRow, error: periodError } = await supabase
    .from('gst_period_data')
    .select('data')
    .eq('company_id', companyId)
    .eq('period_type', type)
    .eq('fy', fy)
    .eq('period', period)
    .maybeSingle()

  if (periodError) {
    return Response.json({ error: periodError.message }, { status: 500 })
  }
  if (!periodRow) {
    return Response.json({ error: 'No data for this period' }, { status: 404 })
  }

  // Fetch company GSTIN for export metadata
  const { data: company } = await supabase
    .from('companies')
    .select('gstin')
    .eq('id', companyId)
    .single()

  const meta: GstnMeta = {
    gstin: (company as any)?.gstin ?? '',
    fy,
    period,
  }

  const sections = (periodRow as any).data

  if (format === 'json') {
    const json = buildGstnJson(sections, meta)
    return new Response(JSON.stringify(json), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${type}-${fy}-${period}.json"`,
      },
    })
  }

  const buffer = buildGstnExcel(sections, meta)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${type}-${fy}-${period}.xlsx"`,
    },
  })
}
