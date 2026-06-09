'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { computeGstr1, updatePeriodStatus } from '@/lib/actions/gst'

interface Gstr1TabProps {
  companyId: string
  fy: string
  period: string
  status: string
}

interface B2bEntry {
  ctin: string
  inv: { inum: string; idt: string; val: number; pos: string; rchrg: string; inv_typ: string; itms: unknown[] }[]
}

interface B2csEntry {
  sply_tp: string
  pos: string
  typ: string
  rt: number
  txval: number
  iamt: number
  camt: number
  samt: number
  csamt: number
}

interface B2clEntry {
  pos: string
  inv: { inum: string; idt: string; val: number; itms: unknown[] }[]
}

interface HsnEntry {
  num: number
  hsn_sc: string
  desc: string
  uqc: string
  qty: number
  val: number
  txval: number
  iamt: number
  camt: number
  samt: number
  csamt: number
}

interface Gstr1Sections {
  b2b: B2bEntry[]
  b2cs: B2csEntry[]
  b2cl: B2clEntry[]
  cdnr: unknown[]
  hsn: HsnEntry[]
}

export function Gstr1Tab({ companyId: _companyId, fy, period, status }: Gstr1TabProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [filing, setFiling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Gstr1Sections | null>(null)

  const filed = status === 'filed'

  function handleMarkFiled() {
    setFiling(true)
    setError(null)
    startTransition(async () => {
      const result = await updatePeriodStatus('GSTR-1', fy, period, 'filed')
      if ('error' in result) {
        setError(result.error)
      } else {
        router.refresh()
      }
      setFiling(false)
    })
  }

  function handleCompute() {
    setLoading(true)
    setError(null)
    startTransition(async () => {
      const result = await computeGstr1(fy, period)
      if ('error' in result) {
        setError(result.error)
      } else {
        setData((result.data as Gstr1Sections) ?? null)
      }
      setLoading(false)
    })
  }

  const exportBase = `/api/gst/export?type=GSTR-1&fy=${fy}&period=${period}`

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">GSTR-1 — Outward Supplies</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleCompute} disabled={loading || filed}>
            {loading ? 'Computing...' : 'Compute'}
          </Button>
          {data && (
            <>
              <Button variant="outline" asChild>
                <a href={`${exportBase}&format=json`} download>
                  Export JSON
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={`${exportBase}&format=excel`} download>
                  Export Excel
                </a>
              </Button>
            </>
          )}
          {!filed && (
            <Button variant="destructive" onClick={handleMarkFiled} disabled={filing || loading}>
              {filing ? 'Filing...' : 'Mark as Filed'}
            </Button>
          )}
        </div>

        {filed && (
          <p className="text-sm text-muted-foreground">This period is filed. No edits allowed.</p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {data && (
          <div className="space-y-4">
            <section>
              <h3 className="text-sm font-medium mb-2">B2B ({data.b2b.length} suppliers)</h3>
              {data.b2b.length === 0 ? (
                <p className="text-xs text-muted-foreground">No B2B invoices</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1 pr-3">GSTIN</th>
                        <th className="text-right py-1 pr-3">Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.b2b.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 pr-3 font-mono">{row.ctin}</td>
                          <td className="py-1 pr-3 text-right">{row.inv.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-medium mb-2">B2CS ({data.b2cs.length} rows)</h3>
              {data.b2cs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No B2CS entries</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1 pr-3">State</th>
                        <th className="text-right py-1 pr-3">Rate%</th>
                        <th className="text-right py-1 pr-3">Taxable</th>
                        <th className="text-right py-1">IGST</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.b2cs.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 pr-3">{row.pos}</td>
                          <td className="py-1 pr-3 text-right">{row.rt}</td>
                          <td className="py-1 pr-3 text-right">₹{row.txval.toFixed(2)}</td>
                          <td className="py-1 text-right">₹{row.iamt.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-medium mb-2">B2CL ({data.b2cl.length} rows)</h3>
              {data.b2cl.length === 0 ? (
                <p className="text-xs text-muted-foreground">No B2CL entries</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1 pr-3">State</th>
                        <th className="text-right py-1">Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.b2cl.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 pr-3">{row.pos}</td>
                          <td className="py-1 text-right">{row.inv.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-medium mb-2">
                HSN Summary ({data.hsn.length} codes)
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  — CDN not yet supported (no credit/debit note type in schema)
                </span>
              </h3>
              {data.hsn.length === 0 ? (
                <p className="text-xs text-muted-foreground">No HSN entries</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1 pr-3">HSN</th>
                        <th className="text-right py-1 pr-3">Taxable</th>
                        <th className="text-right py-1 pr-3">IGST</th>
                        <th className="text-right py-1 pr-3">CGST</th>
                        <th className="text-right py-1">SGST</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.hsn.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 pr-3 font-mono">{row.hsn_sc}</td>
                          <td className="py-1 pr-3 text-right">₹{row.txval.toFixed(2)}</td>
                          <td className="py-1 pr-3 text-right">₹{row.iamt.toFixed(2)}</td>
                          <td className="py-1 pr-3 text-right">₹{row.camt.toFixed(2)}</td>
                          <td className="py-1 text-right">₹{row.samt.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
