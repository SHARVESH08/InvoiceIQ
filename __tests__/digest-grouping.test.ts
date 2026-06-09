// =============================================================================
// InvoiceIQ — EMAIL-03: Low-Stock Digest Grouping Tests
// These are stub tests (it.todo) for Wave 0. Full implementation in Plan 05.
// =============================================================================

import { describe, it, expect, vi } from 'vitest';

describe('EMAIL-03: low-stock digest grouping', () => {
  it.todo(
    "rows grouped by company_id before sending — Company A admin never receives Company B products"
  );

  it.todo(
    'company with no admin user is skipped with console.warn, does not abort other companies'
  );

  it.todo(
    'all admins of a company with multiple admins each receive the email'
  );
});
