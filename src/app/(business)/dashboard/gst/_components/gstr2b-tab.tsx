'use client'

import { useState, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Gstr2bTabProps {
  companyId: string
  fy: string
  period: string
  status: string
}

interface ReconcileResult {
  matched: number
  in2bNotSystem: number
  inSystemNot2b: number
  matchedRows: { gstin: string; invoiceNum: string; invoiceValue: number }[]
  in2BOnly: { gstin: string; invoiceNum: string; invoiceValue: number }[]
  inSystemOnly: { supplier_gstin: string; po_number: string; total_amount: number }[]
}

export function Gstr2bTab({ companyId: _companyId, fy: _fy, period: _period, status }: Gstr2bTabProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ReconcileResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filed = status === 'filed'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/gst/gstr2b-upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }))
        if (res.status === 413) {
          setError('File too large. Maximum size is 10 MB.')
        } else if (res.status === 415) {
          setError('Invalid file type. Only .xlsx files are accepted.')
        } else if (res.status === 422) {
          setError('Could not parse the GSTR-2B Excel file. Ensure it is an official GSTN export.')
        } else {
          setError(body.error ?? `Upload failed (${res.status})`)
        }
      } else {
        const body = await res.json()
        setResult(body.data as ReconcileResult)
      }
    } catch {
      setError('Network error during upload. Please try again.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">GSTR-2B — Purchase Reconciliation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {filed && (
          <p className="text-sm text-muted-foreground">This period is filed. No edits allowed.</p>
        )}

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Upload an official GSTN GSTR-2B Excel export (.xlsx, max 10 MB)
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={isUploading || filed}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? 'Analyzing...' : 'Upload GSTR-2B Excel'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading || filed}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Matched</p>
                <p className="text-2xl font-semibold text-green-400">{result.matched}</p>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">In 2B, not in system</p>
                <p className="text-2xl font-semibold text-amber-400">{result.in2bNotSystem}</p>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">In system, not in 2B</p>
                <p className="text-2xl font-semibold text-blue-400">{result.inSystemNot2b}</p>
              </div>
            </div>

            {result.in2BOnly.length > 0 && (
              <section>
                <h3 className="text-sm font-medium mb-2">In GSTR-2B, not in system</h3>
                <ul className="space-y-1 text-xs font-mono">
                  {result.in2BOnly.map((row, i) => (
                    <li key={i} className="text-amber-400">{row.gstin} — {row.invoiceNum} — ₹{row.invoiceValue}</li>
                  ))}
                </ul>
              </section>
            )}

            {result.inSystemOnly.length > 0 && (
              <section>
                <h3 className="text-sm font-medium mb-2">In system, not in GSTR-2B</h3>
                <ul className="space-y-1 text-xs font-mono">
                  {result.inSystemOnly.map((row, i) => (
                    <li key={i} className="text-blue-400">{row.supplier_gstin} — {row.po_number} — ₹{row.total_amount}</li>
                  ))}
                </ul>
              </section>
            )}

            {result.matchedRows.length > 0 && (
              <section>
                <h3 className="text-sm font-medium mb-2">Matched ({result.matched})</h3>
                <ul className="space-y-1 text-xs font-mono">
                  {result.matchedRows.slice(0, 20).map((row, i) => (
                    <li key={i} className="text-green-400">{row.gstin} — {row.invoiceNum} — ₹{row.invoiceValue}</li>
                  ))}
                  {result.matched > 20 && (
                    <li className="text-muted-foreground">…and {result.matched - 20} more</li>
                  )}
                </ul>
              </section>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
