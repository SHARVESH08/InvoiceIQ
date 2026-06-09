export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const GSTIN_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
}

export function computeGstinChecksum(gstin: string): string {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const charVal = GSTIN_CHARS.indexOf(gstin[i])
    const factor = i % 2 === 0 ? 1 : 2
    const product = charVal * factor
    sum += Math.floor(product / 36) + (product % 36)
  }
  const remainder = sum % 36
  const checkVal = (36 - remainder) % 36
  return GSTIN_CHARS[checkVal]
}

export function validateGstinChecksum(gstin: string): boolean {
  if (!GSTIN_REGEX.test(gstin)) return false
  return gstin[14] === computeGstinChecksum(gstin)
}

export function validateGstin(gstin: string): { valid: boolean; state_code: string | null } {
  const upper = gstin.toUpperCase()
  if (!GSTIN_REGEX.test(upper)) return { valid: false, state_code: null }
  if (!validateGstinChecksum(upper)) return { valid: false, state_code: null }
  return { valid: true, state_code: upper.substring(0, 2) }
}
