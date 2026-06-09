import 'server-only'

export type Intent =
  | { type: 'stock_query'; product: string }
  | { type: 'overdue_invoices' }
  | { type: 'invoice_status'; reference: string }
  | { type: 'gst_deadline'; period: string }
  | { type: 'sales_today' }
  | { type: 'sales_mtd' }
  | { type: 'top_products' }
  | { type: 'pending_payments' }
  | { type: 'customer_balance'; customer: string }
  | { type: 'low_stock' }
  | { type: 'revenue_ytd' }

type Rule = {
  pattern: RegExp
  resolve: (m: RegExpMatchArray) => Intent
  useRaw?: boolean  // match against original input (preserves punctuation for reference extraction)
}

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractProduct(raw: string): string {
  return raw
    .replace(/\b(do|left|available|in|stock|any|of|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const RULES: Rule[] = [
  // ── Revenue YTD (before generic sales to avoid over-match) ──────────────
  {
    pattern: /\b(?:revenue|sales)\s+(?:this\s+year|ytd|year\s+to\s+date)\b/,
    resolve: () => ({ type: 'revenue_ytd' }),
  },
  {
    pattern: /\btotal\s+revenue\s+ytd\b/,
    resolve: () => ({ type: 'revenue_ytd' }),
  },

  // ── Sales MTD ────────────────────────────────────────────────────────────
  {
    pattern: /\bsales\s+(?:this\s+month|mtd|month\s+to\s+date)\b/,
    resolve: () => ({ type: 'sales_mtd' }),
  },
  {
    pattern: /\bmonthly\s+sales\b/,
    resolve: () => ({ type: 'sales_mtd' }),
  },
  {
    // "total sales", "what are my sales", "how much did I sell", "show sales"
    pattern: /\b(?:total\s+sales|what\s+(?:are|were|is)\s+(?:my\s+|the\s+)?sales|how\s+much\s+(?:did\s+(?:i|we)\s+sell|(?:i|we)\s+(?:sold|made))|show\s+(?:my\s+)?sales|my\s+sales)\b/i,
    resolve: () => ({ type: 'sales_mtd' }),
  },

  // ── Sales today ──────────────────────────────────────────────────────────
  {
    // normalize strips apostrophe → "today s sales"; also matches "sales today"
    pattern: /\b(?:today\s+s\s+sales|today\s+sales|sales\s+today)\b/,
    resolve: () => ({ type: 'sales_today' }),
  },

  // ── GST deadlines ────────────────────────────────────────────────────────
  {
    pattern: /\bgstr?\s*[-–]?\s*(3\s*b|3b)\b/i,
    resolve: () => ({ type: 'gst_deadline', period: '3b' }),
  },
  {
    pattern: /\bgstr?\s*[-–]?\s*(9)\b/i,
    resolve: (m) => ({ type: 'gst_deadline', period: m[1] }),
  },
  {
    pattern: /\bgstr?\s*[-–]?\s*(1)\b/i,
    resolve: (m) => ({ type: 'gst_deadline', period: m[1] }),
  },
  {
    pattern: /\bgst\s+filing\s+deadline\b/,
    resolve: () => ({ type: 'gst_deadline', period: '1' }),
  },

  // ── Invoice status (useRaw=true preserves reference format like INV-2025-0042) ──
  {
    pattern: /\b(?:invoice|inv)\b\W*([\w][\w/-]+[\w])/i,
    resolve: (m) => ({ type: 'invoice_status', reference: m[1] }),
    useRaw: true,
  },

  // ── Overdue / unpaid invoices ────────────────────────────────────────────
  {
    pattern: /\b(?:overdue|unpaid|pending)\s+invoices?\b/,
    resolve: () => ({ type: 'overdue_invoices' }),
  },

  // ── Customer balance ─────────────────────────────────────────────────────
  {
    pattern: /\b(?:customer\s+)?(?:balance|outstanding)\s+(?:of|for)\s+(.+)$/,
    resolve: (m) => ({ type: 'customer_balance', customer: m[1].trim() }),
  },

  // ── Pending payments ─────────────────────────────────────────────────────
  {
    pattern: /\b(?:pending|outstanding)\s+payments?\b/,
    resolve: () => ({ type: 'pending_payments' }),
  },

  // ── Low stock ────────────────────────────────────────────────────────────
  {
    pattern: /\blow\s+stock\b/,
    resolve: () => ({ type: 'low_stock' }),
  },

  // ── Top products ─────────────────────────────────────────────────────────
  {
    pattern: /\b(?:top|best)\s+selling\s+(?:products?|items?)\b/,
    resolve: () => ({ type: 'top_products' }),
  },

  // ── Stock queries (most permissive — must come last in stock group) ───────
  {
    pattern: /\bhow\s+many\s+(.+?)\s+(?:do\s+i\s+have|left|available)\b/i,
    resolve: (m) => ({ type: 'stock_query', product: extractProduct(m[1]) }),
  },
  {
    pattern: /\b(?:stock|inventory)\s+of\s+(.+?)(?:\s+(?:left|available))?\s*$/i,
    resolve: (m) => ({ type: 'stock_query', product: extractProduct(m[1]) }),
  },
  {
    pattern: /\b(?:units?|qty|quantity)\s+of\s+(.+?)\s+(?:left|available)\b/i,
    resolve: (m) => ({ type: 'stock_query', product: extractProduct(m[1]) }),
  },
  {
    pattern: /\bdo\s+i\s+have\s+(?:any\s+)?(.+?)\s+in\s+stock\b/i,
    resolve: (m) => ({ type: 'stock_query', product: extractProduct(m[1]) }),
  },
]

export function classifyIntent(rawInput: string): Intent | null {
  if (!rawInput || !rawInput.trim()) return null
  const normalized = normalize(rawInput)
  for (const rule of RULES) {
    const subject = rule.useRaw ? rawInput : normalized
    const match = subject.match(rule.pattern)
    if (match) return rule.resolve(match)
  }
  return null
}
