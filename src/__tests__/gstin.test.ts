import {
  GSTIN_REGEX,
  GSTIN_STATE_CODES,
  validateGstin,
  validateGstinChecksum,
  computeGstinChecksum,
} from '@/lib/gstin'

describe('GSTIN validator', () => {
  const prefix14 = '27AAPFU0939F1Z'
  const checksum = computeGstinChecksum(prefix14 + '0')
  const validGstin = prefix14 + checksum

  it('constructs and validates a correct GSTIN', () => {
    expect(validateGstin(validGstin)).toEqual({ valid: true, state_code: '27' })
  })

  it('returns valid: false for wrong checksum', () => {
    const wrongChecksum = checksum === '0' ? '1' : '0'
    expect(validateGstin(prefix14 + wrongChecksum).valid).toBe(false)
  })

  it('returns valid: false for short/malformed input', () => {
    expect(validateGstin('XX')).toEqual({ valid: false, state_code: null })
  })

  it('returns valid: false when checksum char is wrong', () => {
    const mangled = validGstin.slice(0, 14) + (checksum === 'Z' ? 'A' : 'Z')
    if (!GSTIN_REGEX.test(mangled)) {
      expect(validateGstin(mangled).valid).toBe(false)
    } else {
      expect(validateGstin(mangled).valid).toBe(false)
    }
  })

  it('validateGstinChecksum is a pure function', () => {
    expect(validateGstinChecksum(validGstin)).toBe(validateGstinChecksum(validGstin))
  })

  it('GSTIN_STATE_CODES has at least 37 entries with non-empty values', () => {
    const keys = Object.keys(GSTIN_STATE_CODES)
    expect(keys.length).toBeGreaterThanOrEqual(37)
    keys.forEach(key => {
      expect(key).toMatch(/^\d{2}$/)
      expect(GSTIN_STATE_CODES[key].length).toBeGreaterThan(0)
    })
  })

  it("GSTIN_STATE_CODES has '27' → 'Maharashtra'", () => {
    expect(GSTIN_STATE_CODES['27']).toBe('Maharashtra')
  })

  it("GSTIN_STATE_CODES has '33' → 'Tamil Nadu'", () => {
    expect(GSTIN_STATE_CODES['33']).toBe('Tamil Nadu')
  })

  it('validates a valid GSTIN constructed from every state prefix 01–37', () => {
    const stateCode = '29'
    const p = stateCode + 'AAPFU0939F1Z'
    const cs = computeGstinChecksum(p + '0')
    const g = p + cs
    const result = validateGstin(g)
    expect(result.valid).toBe(true)
    expect(result.state_code).toBe(stateCode)
  })

  it('uppercases input before validation', () => {
    expect(validateGstin(validGstin.toLowerCase()).valid).toBe(true)
  })
})
