import * as XLSX from 'xlsx'

export interface Gstr2bRow {
  gstin: string
  invoiceNum: string
  invoiceDate: string
  invoiceValue: number
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
  cess: number
}

const COLUMN_MAP: Record<string, keyof Gstr2bRow> = {
  'gstin of supplier': 'gstin',
  'invoice number': 'invoiceNum',
  'invoice date': 'invoiceDate',
  'invoice value': 'invoiceValue',
  'taxable value': 'taxableValue',
  'integrated tax': 'igst',
  'central tax': 'cgst',
  'state/ut tax': 'sgst',
  'cess': 'cess',
}

export function parseGstr2bExcel(buffer: ArrayBuffer): Gstr2bRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().startsWith('b2b'))
  if (!sheetName) throw new Error('B2B sheet not found in GSTR-2B Excel')

  const ws = wb.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 }) as any[][]
  if (raw.length < 2) return []

  const headers = (raw[0] as any[]).map((h: any) => String(h ?? '').toLowerCase().trim())
  const colIdx = new Map<keyof Gstr2bRow, number>()
  for (const [header, field] of Object.entries(COLUMN_MAP)) {
    const idx = headers.indexOf(header)
    if (idx !== -1) colIdx.set(field, idx)
  }

  const rows: Gstr2bRow[] = []
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] as any[]
    if (!row || row.every((cell) => cell == null || cell === '')) continue

    const get = (field: keyof Gstr2bRow, fallback: any = '') => {
      const idx = colIdx.get(field)
      return idx !== undefined ? row[idx] : fallback
    }

    rows.push({
      gstin: String(get('gstin', '')).trim(),
      invoiceNum: String(get('invoiceNum', '')).trim(),
      invoiceDate: String(get('invoiceDate', '')).trim(),
      invoiceValue: Number(get('invoiceValue', 0)) || 0,
      taxableValue: Number(get('taxableValue', 0)) || 0,
      igst: Number(get('igst', 0)) || 0,
      cgst: Number(get('cgst', 0)) || 0,
      sgst: Number(get('sgst', 0)) || 0,
      cess: Number(get('cess', 0)) || 0,
    })
  }
  return rows
}
