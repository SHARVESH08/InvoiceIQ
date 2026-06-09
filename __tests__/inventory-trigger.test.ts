// =============================================================================
// InvoiceIQ — INVENTORY-01: Stock Decrement Trigger Tests
// These are stub tests (it.todo) for Wave 0. Full implementation in Wave 2.
// =============================================================================

import { describe, it, expect, vi } from 'vitest';

describe('INVENTORY-01: stock decrement trigger', () => {
  it.todo(
    'decrements inventory quantity exactly once when invoice_items row inserted (no double-trigger)'
  );

  it.todo(
    'raises exception when qty < requested amount (DB error propagates to server action)'
  );

  it.todo(
    'decrement subtracts from available (quantity - reserved_qty) not from quantity directly'
  );

  it.todo(
    'concurrent invoice inserts on same product do not produce negative stock'
  );
});
