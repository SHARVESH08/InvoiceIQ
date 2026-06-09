/**
 * Wave 0 RED stub — NotificationSettings (settings page component)
 * Covers: PORTAL-05 (Switch rendered with correct initial state from emailReminders prop)
 * Implement in Wave 3 (Plan 04).
 */

// Mock the module under test — src/app/(customer)/my/settings/page.tsx (or its
// NotificationSettings client component) will be created in Wave 3.
jest.mock(
  '@/app/(customer)/my/settings/page',
  () => ({ default: () => null }),
  { virtual: true }
)

describe('NotificationSettings', () => {
  it('renders Switch with initial state from emailReminders prop [PORTAL-05 8-04-02]', () => {
    // stub: implement in Wave 3 (Plan 04)
    expect(false).toBe(true) // RED — not implemented
  })
})
