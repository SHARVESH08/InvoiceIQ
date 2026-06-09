/**
 * Wave 0 RED stubs — MyInvoicesPage
 * Covers: PORTAL-01 (invoice list RLS scope), PORTAL-03 (PDF public_id link),
 *         PORTAL-04 (Pay Now payment_link_url), PORTAL-02 (KPI cards)
 * Implement in Wave 1 (Plan 02) and Wave 2 (Plan 03).
 */

// Mock the module under test so the file path can be imported before it exists.
// Wave 1 will create src/app/(customer)/my/page.tsx and replace this mock.
jest.mock('@/app/(customer)/my/page', () => ({ MyInvoicesPage: () => null }), {
  virtual: true,
})

describe('MyInvoicesPage', () => {
  it('renders invoice list scoped to customer_email via RLS [PORTAL-01 8-02-01]', () => {
    // stub: implement in Wave 1 (Plan 02)
    expect(false).toBe(true) // RED — not implemented
  })

  it('PDF link uses public_id not invoice PK [PORTAL-03 8-02-02]', () => {
    // stub: implement in Wave 1 (Plan 02)
    expect(false).toBe(true) // RED — not implemented
  })

  it('Pay Now uses payment_link_url; hidden when null or paid [PORTAL-04 8-02-03]', () => {
    // stub: implement in Wave 1 (Plan 02)
    expect(false).toBe(true) // RED — not implemented
  })

  it('KPI cards display MTD, YTD, all-time, merchant count [PORTAL-02 8-03-02]', () => {
    // stub: implement in Wave 2 (Plan 03)
    expect(false).toBe(true) // RED — not implemented
  })
})
