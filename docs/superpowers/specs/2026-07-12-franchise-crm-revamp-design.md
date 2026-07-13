# Design: Fault Repair, Revamp Samples, Franchise HQ, and CRM Pipeline

**Date:** 2026-07-12
**Status:** Approved (user, 2026-07-12)
**Branch:** ui-ux-revamp
**Execution order:** W1 Faults → W2 Mockups (user visual review gate) → W3 Franchise → W4 CRM

---

## Context

InvoiceIQ is a multi-tenant billing/inventory system: each business is a row in
`companies`, users attach via `company_users(role: admin|accountant|salesperson|ca)`,
and a custom access-token hook pins exactly one `company_id` claim into the JWT.
All RLS policies and dashboard RPCs key off that single claim.

Two feature gaps drive this design:

1. **Franchise owners** with several showrooms (each a separate company/account,
   deliberately, to keep data clean) have no way to see consolidated numbers or
   move between showrooms without separate logins.
2. There is no **CRM**: customers exist as billing records only — no leads,
   deals, interactions, or follow-ups.

Additionally a fault audit found the build safety net disabled and ~49 latent
TypeScript errors, and the user wants a next-level UI pass previewed as
standalone mockups before it touches the app.

---

## Workstream 1 — Fault repair

**Goal:** zero type errors, build-time checks re-enabled, tests stay green.

1. Fix all TypeScript errors in `src/` app code (49 at audit time). Notable:
   - `src/components/invoices/invoice-form.tsx` — result narrowed to `never`
     (`emailFailed` / `invoiceId` access); fix the action's return type union.
   - `src/lib/actions/gst.ts` — four `string | undefined` assignments.
   - `src/app/api/gst/export/route.ts` — `Buffer` passed as `Response` body;
     convert to `Uint8Array`.
   - `src/lib/actions/pricing-monitor.ts` — discriminated-union `Result` type bug.
   - `src/app/api/cron/pricing-alerts/route.ts` — unsafe `Joined[]` cast.
   - `src/lib/actions/invoices.ts` — `{ sent }` not in return type.
2. `tsconfig.json`: add vitest global types (`"types": ["vitest/globals", ...]`)
   so test files pass `tsc`; add `supabase/functions` to `exclude` (Deno code).
3. `next.config.mjs`: set `typescript.ignoreBuildErrors: false` and
   `eslint.ignoreDuringBuilds: false`; update the stale react-pdf comment that
   still says "react@18" (project is on React 19).
4. Verify ESLint 9 runs via `npx eslint .` (Next 16 removed `next lint`).

**Exit criteria:** `npx tsc --noEmit` → 0 errors; `next build` passes with
checks enabled; `npx vitest run` → all tests pass (326 at audit time).

**Out of scope (known, external):** Resend shared-test sender for customer
emails; Meta WhatsApp inbound-webhook delivery blocker.

---

## Workstream 2 — Revamp samples (mockups only, no app changes)

**Goal:** two standalone HTML files the user opens directly in a browser to
judge the design direction. Built with the taste/GSAP/UI-UX skills. The live
app is not modified in this workstream.

- `docs/superpowers/mockups/2026-07-12-landing-v2.html`
  Evolved Midnight Gold landing: GSAP (CDN) scroll choreography — pinned
  feature panels, scrubbed counters, staggered reveals — tightened editorial
  typography, one signature hero moment.
- `docs/superpowers/mockups/2026-07-12-dashboard-v2.html`
  Premium app shell preview: refined sidebar, denser KPI hierarchy, refined
  tables — and previews of the new HQ overview and CRM pipeline kanban so the
  new features are judged in the new skin before implementation.

**Gate:** user reviews both mockups; only approved directions are ported to the
real app in a later, separately-planned workstream.

---

## Workstream 3 — Franchise HQ + company switcher

### Model

A *franchise group* links existing companies without merging their data.
Per-showroom isolation (RLS by `company_id`) is untouched; the owner gets
aggregate reads across the group plus a way to switch the active company.

### Schema (new migration)

- `franchise_groups (id uuid PK, name text NOT NULL, created_at timestamptz)`
- `franchise_owners (group_id FK→franchise_groups ON DELETE CASCADE,
  user_id FK→auth.users, PRIMARY KEY (group_id, user_id))`
- `companies.franchise_group_id uuid NULL REFERENCES franchise_groups(id)`
- `franchise_invites (id, group_id FK, company_id FK, invited_by FK→auth.users,
  status: pending|accepted|declined, expires_at, created_at)` — modeled on the
  existing `invitations` table.

**Consent flow:** owner creates a group and sends an invite targeting a company
(by GSTIN/email lookup). That company's **admin** sees and accepts the invite,
which sets `companies.franchise_group_id`. No company joins a group without its
own admin's explicit acceptance. Leaving a group (admin or owner removes the
link) nulls the FK.

### Data access — SECURITY DEFINER RPCs

Pattern copied from phase-7 dashboard RPCs. Every function first verifies
`EXISTS (SELECT 1 FROM franchise_owners WHERE group_id = <target> AND
user_id = auth.uid())` and returns **aggregates only** — no row-level data
crosses the tenant boundary.

- `get_franchise_overview()` — revenue MTD (ex-GST, issued invoices only,
  matching existing revenue RPC semantics), outstanding total, invoice count,
  low-stock count, member-company count.
- `get_franchise_showroom_comparison()` — one row per member company: name,
  revenue MTD, outstanding, invoice count, low-stock count.
- `get_franchise_revenue_trend(p_months int)` — monthly group revenue.
- `get_franchise_top_products(p_limit int)` — top products by revenue across
  the group (aggregated by product name, since product IDs differ per company).

### UI

- New route group `src/app/(franchise)/hq/` — Overview page (KPI cards, trend
  chart, top products) and Showrooms page (comparison table + invite management).
- Sidebar shows an "HQ" nav entry only when the user is a franchise owner
  (server-checked, passed through `NavContext`).
- Group management: create group, invite showroom, see pending invites.
  Showroom admins see incoming invites in Settings and accept/decline there.

### Switcher (phase 2 of W3)

- Auth hook change: if `app_metadata.active_company_id` is set **and** the user
  has a `company_users` row for that company, use it; otherwise keep current
  admin-first/oldest-first behavior.
- Server action `switchActiveCompany(companyId)`: validates membership via
  admin client, updates `app_metadata.active_company_id`, then the client calls
  `supabase.auth.refreshSession()` and reloads.
- Owner drill-down: accepting a franchise invite also grants the group's owners
  a `company_users` row (role `admin`) in the joining company — this is part of
  the consent the showroom admin accepts. HQ's "Open showroom →" uses the
  switcher to jump into that company's dashboard.
- Sidebar gains a compact company switcher (visible only to multi-membership
  users).

### Security invariants

- RLS policies unchanged; single-`company_id` JWT model unchanged.
- Cross-company reads happen **only** through the four franchise RPCs, which
  gate on `franchise_owners` and return aggregates.
- Franchise tables get RLS: owners see their groups; company admins see
  invites addressed to their company.

---

## Workstream 4 — CRM (full sales pipeline)

### Schema (new migration; every table `company_id`-scoped, standard RLS pattern)

- `crm_leads (id, company_id, name NOT NULL, phone, email, source
  text: walk_in|referral|whatsapp|online|other, status:
  new|contacted|qualified|converted|lost, customer_id uuid NULL FK→customers
  (set on conversion), assigned_to uuid NULL FK→auth.users, notes text,
  created_at, updated_at)`
- `crm_deals (id, company_id, title NOT NULL, value numeric(12,2),
  stage: qualified|proposal|negotiation|won|lost, expected_close date,
  lead_id NULL FK, customer_id NULL FK, assigned_to, created_at, updated_at)`
- `crm_interactions (id, company_id, type: call|email|whatsapp|visit|note,
  content text NOT NULL, customer_id NULL FK, lead_id NULL FK, deal_id NULL FK,
  created_by FK→auth.users, occurred_at timestamptz DEFAULT now())`
  — CHECK: at least one of customer_id/lead_id/deal_id is set.
- `crm_tasks (id, company_id, title NOT NULL, due_date date NOT NULL,
  status: open|done, customer_id NULL FK, lead_id NULL FK, deal_id NULL FK,
  assigned_to, created_by, created_at)`

### Server actions (`src/lib/actions/crm.ts`)

CRUD for leads/deals/interactions/tasks; `convertLead(leadId)` creates a
customer (reusing existing customer-create logic) and links it; `moveDealStage`
for kanban drag; segment queries computed from existing invoice data.

### UI — new "CRM" sidebar item → `/crm` (business route group)

1. **Pipeline** — kanban by deal stage, drag-to-move, per-column ₹ totals.
2. **Leads** — table with status filters, quick-add, convert-to-customer/deal.
3. **Follow-ups** — tasks grouped: overdue / due today / upcoming; check-off.
4. **Insights** — conversion funnel (leads→converted, deals won/lost) and
   auto-segments from invoice history: Top spenders, Overdue payers, At-risk
   (no purchase in 90 days), New (first purchase < 30 days).

Customer detail page gains a merged chronological **timeline** (invoices,
payments, interactions). Business dashboard gains a "Follow-ups due today"
widget. Group-level (HQ) CRM aggregates are explicitly out of scope for v1.

---

## Testing strategy

- Vitest unit tests for every new server action (mock Supabase client, matching
  existing test patterns), nav gating (HQ/CRM visibility), lead conversion,
  deal-stage transitions, and franchise invite acceptance rules.
- RPC SQL is reviewed against the ownership-check invariant; aggregates
  validated in tests via mocked RPC responses.
- Suite must remain green at every commit; type-check clean is enforced by the
  re-enabled build checks from W1.

## Decisions log

- Franchise model: HQ dashboard + switcher, phased (user-selected).
- CRM depth: full sales pipeline (user-selected, over customer-360-only).
- Mockups: landing + dashboard, standalone HTML, review-gated (user-selected).
- Order: faults → mockups → franchise → CRM (user-selected).
- Showroom joining a group grants group owners admin membership in that
  company — consent happens at invite acceptance.
- Franchise aggregates use issued-invoice, ex-GST revenue semantics to match
  existing dashboard RPCs.
