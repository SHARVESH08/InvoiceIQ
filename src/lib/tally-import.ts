import { z } from 'zod'
import Papa from 'papaparse'

// ─── Schema ───────────────────────────────────────────────────────────────────

export const TallyRowSchema = z.object({
  invoice_date: z.string().min(1, 'invoice_date required'),
  tally_voucher_no: z.string().optional(),
  customer_name: z.string().min(1, 'customer_name required'),
  customer_gstin: z.string().optional(),
  taxable_amount: z.coerce.number().min(0).default(0),
  cgst_amount: z.coerce.number().min(0).default(0),
  sgst_amount: z.coerce.number().min(0).default(0),
  igst_amount: z.coerce.number().min(0).default(0),
  total_amount: z.coerce.number().min(0),
})

export type TallyRowInput = z.infer<typeof TallyRowSchema>

// ─── Column alias mapping ─────────────────────────────────────────────────────

export const TALLY_COLUMN_ALIASES: Record<keyof TallyRowInput, string[]> = {
  invoice_date: ['Date', 'Invoice Date', 'Voucher Date'],
  tally_voucher_no: ['Voucher No', 'Voucher Number', 'Invoice No'],
  customer_name: ['Party Name', 'Party', 'Customer Name', 'Ledger'],
  customer_gstin: ['GSTIN/UIN', 'GSTIN', 'Party GSTIN'],
  taxable_amount: ['Taxable Value', 'Taxable Amount'],
  cgst_amount: ['CGST Amount', 'Central Tax', 'CGST'],
  sgst_amount: ['SGST Amount', 'State Tax', 'SGST'],
  igst_amount: ['IGST Amount', 'Integrated Tax', 'IGST'],
  total_amount: ['Total Amount', 'Net Amount', 'Grand Total'],
}

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Maps raw Tally CSV column names to canonical field names using alias lookup.
 * Case-insensitive and trims whitespace.
 */
export function normalizeTallyRow(rawRow: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {}

  for (const [canonicalKey, aliases] of Object.entries(TALLY_COLUMN_ALIASES)) {
    for (const alias of aliases) {
      // Find a key in rawRow matching this alias (case-insensitive)
      const matchingKey = Object.keys(rawRow).find(
        (k) => k.trim().toLowerCase() === alias.toLowerCase()
      )
      if (matchingKey !== undefined) {
        normalized[canonicalKey] = rawRow[matchingKey]
        break
      }
    }
  }

  return normalized
}

// ─── Parse result type ────────────────────────────────────────────────────────

export type ParseTallyCsvResult = {
  valid: TallyRowInput[]
  invalid: Array<{
    rowIndex: number
    raw: Record<string, string>
    errors: string[]
  }>
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse a Tally-exported CSV file.
 * Accepts a File (browser) or a CSV string (for Node/test environments).
 * Returns a Promise<ParseTallyCsvResult> splitting rows into valid/invalid.
 * Follows the same pattern as src/app/(business)/products/import/page.tsx.
 */
export function parseTallyCsv(input: File | string): Promise<ParseTallyCsvResult> {
  return new Promise((resolve) => {
    // Papa.parse overloads File and string separately, so narrow rather than
    // casting the input — the two branches share one config object.
    const config: Papa.ParseConfig<Record<string, string>> & {
      complete: (result: Papa.ParseResult<Record<string, string>>) => void
    } = {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const valid: TallyRowInput[] = []
        const invalid: ParseTallyCsvResult['invalid'] = []

        result.data.forEach((rawRow, idx) => {
          const normalized = normalizeTallyRow(rawRow)
          const parsed = TallyRowSchema.safeParse(normalized)
          if (parsed.success) {
            valid.push(parsed.data)
          } else {
            invalid.push({
              rowIndex: idx + 2, // +2: 1-based + header row
              raw: rawRow,
              errors: parsed.error.issues.map((i) => i.message),
            })
          }
        })

        resolve({ valid, invalid })
      },
    }

    if (typeof input === 'string') {
      Papa.parse<Record<string, string>>(input, config)
    } else {
      Papa.parse<Record<string, string>>(input, config as Papa.ParseLocalConfig<
        Record<string, string>,
        File
      >)
    }
  })
}
