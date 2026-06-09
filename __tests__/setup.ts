// =============================================================================
// InvoiceIQ — Phase 6 Test Fixtures
// Shared Supabase test client helpers for Phase 6 test suites.
// =============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns a Supabase client using env vars.
 * In unit tests these env vars are stubbed; they are never real credentials.
 */
export function createTestClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? 'http://localhost:54321';
  const key = process.env.SUPABASE_ANON_KEY ?? 'test-anon-key';
  return createClient(url, key);
}

/** Stable UUID used across Phase 6 unit tests for company scoping. */
export const mockCompanyId = '00000000-0000-0000-0000-000000000001';

/** Stable UUID for a default godown. */
export const mockGodownId = '00000000-0000-0000-0000-000000000002';

/** Stable UUID for a second godown (used in multi-godown tests). */
export const mockGodownId2 = '00000000-0000-0000-0000-000000000003';

/** Stable UUID for a test product. */
export const mockProductId = '00000000-0000-0000-0000-000000000004';

/** Stable UUID for a test user (requester). */
export const mockUserId = '00000000-0000-0000-0000-000000000005';

/** Stable UUID for a second test user (approver). */
export const mockApproverId = '00000000-0000-0000-0000-000000000006';
