'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { ChevronLeft, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { importProducts } from '@/lib/actions/products'
import { ProductImportSchema } from '@/lib/schemas/product'

// ─── Types ────────────────────────────────────────────────────────────────────
type RawRow = Record<string, string>

type ParsedRow = {
  raw: RawRow
  error: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ImportProductsPage() {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [isImporting, setIsImporting] = useState(false)

  // ── Row validation ──────────────────────────────────────────────────────────
  function processRows(rawRows: RawRow[]) {
    const parsed: ParsedRow[] = rawRows.map((row) => {
      const result = ProductImportSchema.safeParse(row)
      return {
        raw: row,
        error: result.success
          ? null
          : (result.error.issues[0]?.message ?? 'Invalid row'),
      }
    })
    setRows(parsed)
  }

  // ── File parse — triggered on file selection (no button click required) ─────
  function handleFile(file: File) {
    if (file.name.toLowerCase().endsWith('.csv')) {
      Papa.parse<RawRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => processRows(result.data),
      })
    } else {
      // .xlsx (and other Excel variants)
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const json = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' })
          processRows(json)
        } catch {
          toast.error(
            'Failed to parse Excel file. Ensure it is a valid .xlsx file and try again.'
          )
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }

  // ── Derived counts ──────────────────────────────────────────────────────────
  const validRows = rows
    .filter((r) => r.error === null)
    .map((r) => r.raw as Record<string, string>)
  const validCount = validRows.length
  const invalidCount = rows.length - validCount

  // ── Commit handler ──────────────────────────────────────────────────────────
  async function handleCommit() {
    setIsImporting(true)
    // importProducts re-validates server-side; on success it redirects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (importProducts as any)(validRows)
    // If importProducts redirected, this code is unreachable.
    // If it returned an error object:
    if (result?.error) {
      toast.error(result.error as string)
      setIsImporting(false)
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/products"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Products
        </Link>
      </div>

      {/* Page title */}
      <h1 className="text-2xl font-bold tracking-tight mb-6">
        Import Products
      </h1>

      {/* Card 1 — Upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
          <CardDescription>
            Upload an Excel (.xlsx) or CSV file. The file is parsed immediately
            after selection — no button click required.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Input
            type="file"
            accept=".xlsx,.csv"
            className="max-w-xs"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          <Button variant="outline" size="sm" asChild>
            <a
              href="/templates/products-import-template.csv"
              download
              className="inline-flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              Download Template
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Card 2 — Preview (only when rows are available) */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {validCount} valid rows · {invalidCount} rows with errors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>name</TableHead>
                    <TableHead>hsn_code</TableHead>
                    <TableHead>unit</TableHead>
                    <TableHead className="text-right">purchase_price</TableHead>
                    <TableHead className="text-right">selling_price</TableHead>
                    <TableHead className="text-right">tax_rate</TableHead>
                    <TableHead className="text-right">reorder_level</TableHead>
                    <TableHead>category</TableHead>
                    <TableHead>Status / Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow
                      key={index}
                      className={
                        row.error !== null ? 'bg-destructive/10' : undefined
                      }
                    >
                      <TableCell>{row.raw.name ?? '—'}</TableCell>
                      <TableCell>{row.raw.hsn_code ?? '—'}</TableCell>
                      <TableCell>{row.raw.unit ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {row.raw.purchase_price ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.raw.selling_price ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.raw.tax_rate ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.raw.reorder_level ?? '—'}
                      </TableCell>
                      <TableCell>{row.raw.category ?? '—'}</TableCell>
                      <TableCell>
                        {row.error !== null ? (
                          <span className="text-xs text-destructive">
                            {row.error}
                          </span>
                        ) : (
                          <Badge variant="secondary">Valid</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Zero valid rows notice */}
            {validCount === 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                No valid rows found. Check the file format and try again.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 mt-4">
              <Button
                onClick={handleCommit}
                disabled={validCount === 0 || isImporting}
              >
                {isImporting && (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                )}
                Import {validCount} valid rows
              </Button>
              <Button
                variant="outline"
                onClick={() => setRows([])}
                disabled={isImporting}
              >
                Clear File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
