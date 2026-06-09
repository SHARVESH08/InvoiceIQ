// =============================================================================
// InvoiceIQ — INVENTORY-02: Low-Stock Alert Trigger Tests
// These are stub tests (it.todo) for Wave 0. Full implementation in Wave 2.
// =============================================================================

import { describe, it, expect, vi } from 'vitest';

describe('INVENTORY-02: low-stock alert trigger', () => {
  it.todo(
    'upserts pricing_alerts row when quantity drops to or below reorder_level (UPSERT idempotent — calling trigger twice produces one row)'
  );

  it.todo(
    'deletes pricing_alerts row when quantity rises above reorder_level (replenishment clears alert)'
  );

  it.todo(
    'fires on INSERT when initial quantity is already below reorder_level (backfill scenario)'
  );

  it.todo(
    'does NOT fire on INSERT when quantity above reorder_level'
  );

  it.todo(
    'produces separate alert rows for same product across different godowns (godown-scoped uniqueness)'
  );
});
