import 'server-only'

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigit(n: number): string {
  if (n < 20) return ones[n]
  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
}

function threeDigit(n: number): string {
  if (n >= 100) {
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigit(n % 100) : '')
  }
  return twoDigit(n)
}

/**
 * Converts a paise integer to Indian lakh/crore words format.
 * Truncates paise — only whole rupees are spoken (D-03).
 *
 * @param totalPaise - Total amount in paise (integer)
 * @returns "Rupees ... Only" string in Indian lakh/crore system
 *
 * @example
 * rupeesToWords(0)          // "Rupees Zero Only"
 * rupeesToWords(100)        // "Rupees One Only"
 * rupeesToWords(125000000)  // "Rupees Twelve Lakh Fifty Thousand Only"
 */
export function rupeesToWords(totalPaise: number): string {
  const rupees = Math.floor(totalPaise / 100)
  if (rupees === 0) return 'Rupees Zero Only'

  const crore = Math.floor(rupees / 10_000_000)
  const lakh = Math.floor((rupees % 10_000_000) / 100_000)
  const thousand = Math.floor((rupees % 100_000) / 1_000)
  const remainder = rupees % 1_000

  const parts: string[] = []
  if (crore) parts.push(threeDigit(crore) + ' Crore')
  if (lakh) parts.push(threeDigit(lakh) + ' Lakh')
  if (thousand) parts.push(threeDigit(thousand) + ' Thousand')
  if (remainder) parts.push(threeDigit(remainder))

  return 'Rupees ' + parts.join(' ') + ' Only'
}
