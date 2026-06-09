// =============================================================================
// InvoiceIQ — INVENTORY-03: Pricing Alerts Backfill Tests
// These are stub tests (it.todo) for Wave 0. Full implementation in Wave 2.
// =============================================================================

import { describe, it, expect, vi } from 'vitest';

describe('INVENTORY-03: pricing_alerts backfill on migration', () => {
  it.todo(
    'migration seeds pricing_alerts for existing inventory rows where quantity <= reorder_level'
  );

  it.todo(
    'migration backfill is idempotent — re-running does not duplicate rows (ON CONFLICT UPDATE)'
  );
});
