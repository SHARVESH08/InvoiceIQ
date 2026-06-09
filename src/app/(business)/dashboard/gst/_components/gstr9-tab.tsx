'use client'

import { useState, startTransition } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { computeGstr9 } from '@/lib/actions/gst'

interface Gstr9TabProps {
  companyId: string
  fy: string
  status: string
}

interface Gstr9Data {
  table4?: { txval: number; igst: number; cgst: number; sgst: number }
  table9?: { igst: number; cgst: number; sgst: number }
}

export function Gstr9Tab({ companyId: _companyId, fy, status }: Gstr9TabProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Gstr9Data | null>(null)

  const filed = status === 'filed'

  function handleCompute() {
    setLoading(true)
    setError(null)
    startTransition(async () => {
      const result = await computeGstr9(fy)
      if ('error' in result) {
        setError(result.error)
      } else {
        setData((result.data as Gstr9Data) ?? null)
      }
      setLoading(false)
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">GSTR-9 — Annual Return ({fy})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleCompute} disabled={loading || filed}>
            {loading ? 'Computing...' : 'Compute Annual'}
          </Button>
        </div>

        {filed && (
          <p className="text-sm text-muted-foreground">This return is filed. No edits allowed.</p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {data && (
          <div className="space-y-4">
            {data.table4 && (
              <section>
                <h3 className="text-sm font-medium mb-2">Table 4 — Outward Supplies (Annual)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1 pr-3">Taxable Value</th>
                        <th className="text-right py-1 pr-3">IGST</th>
                        <th className="text-right py-1 pr-3">CGST</th>
                        <th className="text-right py-1">SGST</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1 pr-3 font-mono">₹{data.table4.txval.toFixed(2)}</td>
                        <td className="py-1 pr-3 text-right font-mono">₹{data.table4.igst.toFixed(2)}</td>
                        <td className="py-1 pr-3 text-right font-mono">₹{data.table4.cgst.toFixed(2)}</td>
                        <td className="py-1 text-right font-mono">₹{data.table4.sgst.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {data.table9 && (
              <section>
                <h3 className="text-sm font-medium mb-2">Table 9 — Tax Paid (ITC Annual)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-right py-1 pr-3">IGST</th>
                        <th className="text-right py-1 pr-3">CGST</th>
                        <th className="text-right py-1">SGST</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1 pr-3 text-right font-mono">₹{data.table9.igst.toFixed(2)}</td>
                        <td className="py-1 pr-3 text-right font-mono">₹{data.table9.cgst.toFixed(2)}</td>
                        <td className="py-1 text-right font-mono">₹{data.table9.sgst.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {!data.table4 && !data.table9 && (
              <p className="text-xs text-muted-foreground">
                No monthly data found for FY {fy}. Compute GSTR-1 and GSTR-3B for each month first.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
