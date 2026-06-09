'use client'

import { useState, startTransition } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveGstr3b } from '@/lib/actions/gst'

interface Gstr3bTabProps {
  companyId: string
  fy: string
  period: string
  status: string
}

interface ItcState {
  igst: string
  cgst: string
  sgst: string
}

export function Gstr3bTab({ companyId: _companyId, fy, period, status }: Gstr3bTabProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [itc, setItc] = useState<ItcState>({ igst: '0', cgst: '0', sgst: '0' })
  const [outputTax, setOutputTax] = useState<{ igst: number; cgst: number; sgst: number } | null>(null)

  const filed = status === 'filed'

  const itcNum = {
    igst: Math.max(0, parseFloat(itc.igst) || 0),
    cgst: Math.max(0, parseFloat(itc.cgst) || 0),
    sgst: Math.max(0, parseFloat(itc.sgst) || 0),
  }

  const netPayable = outputTax
    ? {
        igst: Math.max(0, outputTax.igst - itcNum.igst),
        cgst: Math.max(0, outputTax.cgst - itcNum.cgst),
        sgst: Math.max(0, outputTax.sgst - itcNum.sgst),
      }
    : null

  function handleSave() {
    setLoading(true)
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await saveGstr3b(fy, period, itcNum)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSaved(true)
        const d = (result.data as any)
        if (d?.outward) setOutputTax(d.outward)
      }
      setLoading(false)
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">GSTR-3B — Summary Return</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {filed && (
          <p className="text-sm text-muted-foreground">This period is filed. No edits allowed.</p>
        )}

        {outputTax && (
          <section>
            <h3 className="text-sm font-medium mb-2">Output Tax Liability</h3>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">IGST</p>
                <p className="font-mono">₹{outputTax.igst.toFixed(2)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">CGST</p>
                <p className="font-mono">₹{outputTax.cgst.toFixed(2)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">SGST</p>
                <p className="font-mono">₹{outputTax.sgst.toFixed(2)}</p>
              </div>
            </div>
          </section>
        )}

        <section>
          <h3 className="text-sm font-medium mb-2">Input Tax Credit (Manual)</h3>
          <div className="grid grid-cols-3 gap-3">
            {(['igst', 'cgst', 'sgst'] as const).map((key) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase">{key}</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itc[key]}
                  onChange={(e) => setItc((prev) => ({ ...prev, [key]: e.target.value }))}
                  disabled={filed}
                  className="font-mono"
                />
              </div>
            ))}
          </div>
        </section>

        {netPayable && (
          <section>
            <h3 className="text-sm font-medium mb-2">Net Tax Payable</h3>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">IGST</p>
                <p className="font-mono font-semibold">₹{netPayable.igst.toFixed(2)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">CGST</p>
                <p className="font-mono font-semibold">₹{netPayable.cgst.toFixed(2)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">SGST</p>
                <p className="font-mono font-semibold">₹{netPayable.sgst.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total: ₹{(netPayable.igst + netPayable.cgst + netPayable.sgst).toFixed(2)}
            </p>
          </section>
        )}

        {!outputTax && !filed && (
          <p className="text-xs text-muted-foreground">
            Enter ITC values and click Save. Output tax is derived from computed GSTR-1.
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={loading || filed}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
          {saved && <span className="text-sm text-green-600">Saved</span>}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
