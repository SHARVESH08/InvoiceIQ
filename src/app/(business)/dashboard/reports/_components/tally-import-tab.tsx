'use client'

import { useRef, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { parseTallyCsv } from '@/lib/tally-import'
import type { TallyRowInput, ParseTallyCsvResult } from '@/lib/tally-import'
import { importTallyInvoices } from '@/lib/actions/reports'
import { triggerDownload } from '@/lib/export'

// Tally standard column headers for the mapping template
const TEMPLATE_HEADERS = [
  'Date',
  'Voucher No',
  'Party Name',
  'GSTIN/UIN',
  'Taxable Value',
  'CGST Amount',
  'SGST Amount',
  'IGST Amount',
  'Total Amount',
]

const TEMPLATE_EXAMPLE = [
  '01-Apr-25',
  'SL-001',
  'ABC Traders',
  '29ABCDE1234F1Z5',
  '10000',
  '900',
  '900',
  '0',
  '11800',
]

function buildTemplateCsv(): string {
  return [TEMPLATE_HEADERS.join(','), TEMPLATE_EXAMPLE.join(',')].join('\n')
}

export function TallyImportTab() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parseResult, setParseResult] = useState<ParseTallyCsvResult | null>(null)
  const [importing, setImporting] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await parseTallyCsv(file)
    setParseResult(result)
  }

  function handleDownloadTemplate() {
    const csv = buildTemplateCsv()
    triggerDownload(csv, 'tally-import-template.csv', 'text/csv')
  }

  async function handleImport() {
    if (!parseResult || parseResult.valid.length === 0) return
    setImporting(true)
    try {
      const result = await importTallyInvoices(parseResult.valid as TallyRowInput[])
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      if (result.skipped > 0) {
        toast.success(
          `Imported ${result.imported} invoices. ${result.skipped} rows skipped — see error list.`
        )
      } else {
        toast.success(`Imported ${result.imported} invoices successfully.`)
      }
      setParseResult(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      setImporting(false)
    }
  }

  function handleClear() {
    setParseResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Card 1 — Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Tally Export</CardTitle>
          <CardDescription>
            Upload a Tally Sales Register CSV export. The file is parsed immediately after selection.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="max-w-xs"
            onChange={handleFileChange}
          />
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-1" />
            Download Mapping Template
          </Button>
        </CardContent>
      </Card>

      {/* Card 2 — Preview (conditional) */}
      {parseResult !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {parseResult.valid.length} valid rows · {parseResult.invalid.length} rows with errors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Voucher No</TableHead>
                    <TableHead>Party Name</TableHead>
                    <TableHead>GSTIN/UIN</TableHead>
                    <TableHead className="text-right">Taxable Value</TableHead>
                    <TableHead className="text-right">CGST Amount</TableHead>
                    <TableHead className="text-right">SGST Amount</TableHead>
                    <TableHead className="text-right">IGST Amount</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead>Status / Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Valid rows */}
                  {parseResult.valid.map((row, index) => (
                    <TableRow key={`valid-${index}`}>
                      <TableCell>{row.invoice_date}</TableCell>
                      <TableCell>{row.tally_voucher_no ?? '—'}</TableCell>
                      <TableCell>{row.customer_name}</TableCell>
                      <TableCell>{row.customer_gstin ?? '—'}</TableCell>
                      <TableCell className="text-right">{row.taxable_amount}</TableCell>
                      <TableCell className="text-right">{row.cgst_amount}</TableCell>
                      <TableCell className="text-right">{row.sgst_amount}</TableCell>
                      <TableCell className="text-right">{row.igst_amount}</TableCell>
                      <TableCell className="text-right">{row.total_amount}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Valid</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Invalid rows */}
                  {parseResult.invalid.map((inv) => (
                    <TableRow key={`invalid-${inv.rowIndex}`} className="bg-destructive/10">
                      <TableCell>{inv.raw['Date'] ?? inv.raw['Invoice Date'] ?? '—'}</TableCell>
                      <TableCell>{inv.raw['Voucher No'] ?? inv.raw['Voucher Number'] ?? '—'}</TableCell>
                      <TableCell>{inv.raw['Party Name'] ?? inv.raw['Ledger'] ?? '—'}</TableCell>
                      <TableCell>{inv.raw['GSTIN/UIN'] ?? inv.raw['GSTIN'] ?? '—'}</TableCell>
                      <TableCell className="text-right">{inv.raw['Taxable Value'] ?? '—'}</TableCell>
                      <TableCell className="text-right">{inv.raw['CGST Amount'] ?? '—'}</TableCell>
                      <TableCell className="text-right">{inv.raw['SGST Amount'] ?? '—'}</TableCell>
                      <TableCell className="text-right">{inv.raw['IGST Amount'] ?? '—'}</TableCell>
                      <TableCell className="text-right">{inv.raw['Total Amount'] ?? '—'}</TableCell>
                      <TableCell>
                        <span className="text-xs text-destructive">
                          {inv.errors.join('; ')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Zero valid rows notice */}
            {parseResult.valid.length === 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                No valid rows found. Check the file format and try again.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 mt-4">
              <Button
                variant="default"
                disabled={parseResult.valid.length === 0 || importing}
                onClick={handleImport}
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Import {parseResult.valid.length} valid rows
              </Button>
              <Button variant="outline" disabled={importing} onClick={handleClear}>
                Clear File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
