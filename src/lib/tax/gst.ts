import { GSTIN_REGEX } from '@/lib/gstin'

export type TaxType = 'intra' | 'inter'

export interface LineItemTaxResult {
  grossPaise: number
  discountPaise: number
  taxableAmountPaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
}

export function determineTaxType(
  sellerStateCode: string,
  buyerGstin: string | null,
  buyerStateCode: string | null
): TaxType {
  if (buyerGstin) {
    const upper = buyerGstin.toUpperCase()
    if (GSTIN_REGEX.test(upper) && upper.substring(0, 2) === sellerStateCode) {
      return 'intra'
    }
    return 'inter'
  }
  if (buyerStateCode && buyerStateCode === sellerStateCode) {
    return 'intra'
  }
  return 'inter'
}

// Returns per-line tax amounts in integer paise.
// taxableAmountPaise may be fractional if qty or discount produce non-integer gross;
// totalTaxPaise is rounded to nearest paise before the CGST/SGST split.
export function computeLineItemTax(
  ratePaise: number,
  qtyMilli: number,
  discountBps: number,
  taxBps: number,
  taxType: TaxType
): { taxableAmountPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number } {
  const grossPaise = (ratePaise * qtyMilli) / 1000
  const discountPaise = (grossPaise * discountBps) / 10000
  const taxableAmountPaise = grossPaise - discountPaise
  const totalTaxPaise = Math.round((taxableAmountPaise * taxBps) / 10000)

  if (taxType === 'intra') {
    const cgstPaise = Math.floor(totalTaxPaise / 2)
    const sgstPaise = totalTaxPaise - cgstPaise
    return { taxableAmountPaise, cgstPaise, sgstPaise, igstPaise: 0 }
  }
  return { taxableAmountPaise, cgstPaise: 0, sgstPaise: 0, igstPaise: totalTaxPaise }
}

// Sums unrounded paise across all line items and converts to rupees.
// This is the single rupee-conversion point for an invoice.
export function computeInvoiceTotals(lineItems: LineItemTaxResult[]): {
  subtotal: number
  discount_amount: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
} {
  let totalGrossPaise = 0
  let totalDiscountPaise = 0
  let totalTaxablePaise = 0
  let totalCgstPaise = 0
  let totalSgstPaise = 0
  let totalIgstPaise = 0

  for (const item of lineItems) {
    totalGrossPaise += item.grossPaise
    totalDiscountPaise += item.discountPaise
    totalTaxablePaise += item.taxableAmountPaise
    totalCgstPaise += item.cgstPaise
    totalSgstPaise += item.sgstPaise
    totalIgstPaise += item.igstPaise
  }

  return {
    subtotal: roundToRupee(totalGrossPaise),
    discount_amount: roundToRupee(totalDiscountPaise),
    taxable_amount: roundToRupee(totalTaxablePaise),
    cgst_amount: roundToRupee(totalCgstPaise),
    sgst_amount: roundToRupee(totalSgstPaise),
    igst_amount: roundToRupee(totalIgstPaise),
    total_amount: roundToRupee(
      totalTaxablePaise + totalCgstPaise + totalSgstPaise + totalIgstPaise
    ),
  }
}

export function roundToRupee(paise: number): number {
  return Math.round(paise) / 100
}
