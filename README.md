<div align="center">

# InvoiceIQ

**GST billing, inventory, CRM and franchise management for Indian SMBs — in one system.**

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Tests](https://img.shields.io/badge/tests-420%20passing-3FBF7F)](#testing)

</div>

---

## What it is

Most Indian SMBs run their books in one desktop application, their stock in a
register, their leads in a spreadsheet, and their customer follow-ups on
WhatsApp. Nothing reconciles, and head office finds out how a branch did at
month end.

InvoiceIQ puts billing, inventory, the sales pipeline and multi-branch reporting
on **one schema**, in the browser, with tenant isolation enforced by the
database rather than by application code.

## Features

| | |
|---|---|
| **GST billing** | Invoices, credit/debit notes, HSN summaries, public invoice links, PDF generation. CGST+SGST vs IGST derived from state codes, never entered by hand. |
| **GST returns** | GSTR-1, GSTR-3B and GSTR-9 computed from live invoice data, with GSTN-format export and GSTR-2B purchase reconciliation. |
| **Inventory** | Multi-godown stock, transfers with approval, COGS from purchase price, low-stock alerts, purchase orders across the OEM → distributor chain. |
| **CRM** | Leads → deals → invoices in one pipeline, with interaction history and click-to-call (recordings via Exotel when configured). |
| **Franchise HQ** | Showrooms join a group by consent. Head office reads live aggregates while each member company stays isolated by RLS. |
| **Customer portal** | Customers see invoices from every business that billed them, pay online, and export the lot to Excel. |
| **AI assistant** | Natural-language questions over live business data, from a bubble on every page. |
| **Notifications** | Per-user inbox for franchise invites, low stock and purchase-order transitions. |
| **Access control** | Six roles, enforced in the UI and independently re-checked in every mutating server action. |

## Architecture

```
Browser ── Next.js 16 App Router (Vercel) ── Supabase Postgres
           │  Server Components by default    │  Row Level Security
           │  Server Actions + Zod validation │  SECURITY DEFINER RPCs
           │  Role guards per route segment   │  43 versioned migrations
           │
           └── Razorpay · Resend · WhatsApp Cloud API · Exotel · Groq
```

**Multi-tenancy lives in the database.** Every table is scoped by `company_id`
under RLS, and cross-company reads (franchise aggregates) go through audited
`SECURITY DEFINER` functions. A bug in application code cannot leak another
tenant's data.

**Authorization is checked twice.** `src/lib/auth/permissions.ts` is the single
source of truth; the sidebar uses it to decide what to *show*, and
`requirePermission()` in each server action decides what to *allow*. Hiding a
button is a convenience, not the boundary.

## Roles

| Role | Can do |
|---|---|
| `admin` | Everything, including team management and company settings |
| `manager` | All day-to-day operations; not team or settings |
| `billing` | Invoices and customers; reads stock, cannot change it |
| `accountant` | GST filing and reports; read-only elsewhere |
| `salesperson` | Invoices, customers, CRM pipeline |
| `ca` | External accountant — read-only GST and reports, no operational visibility |

## Getting started

**Prerequisites:** Node.js 20+, a [Supabase](https://supabase.com) project, and
the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
git clone https://github.com/SHARVESH08/InvoiceIQ.git
cd InvoiceIQ
npm install

cp .env.local.example .env.local   # then fill in the values
npx supabase link --project-ref <your-project-ref>
npx supabase db push               # applies all migrations

npm run dev                        # http://localhost:3000
```

### Environment

Only the first three are required to boot; the rest unlock individual features.

| Variable | Required | Purpose |
|---|:---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public client key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only; never exposed to the browser |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | | Transactional email — see the caveat below |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | | Payment links on invoices |
| `GROQ_API_KEY` | | AI assistant |
| `WHATSAPP_*` | | WhatsApp ordering bot |
| `CRON_SECRET` | | Authenticates scheduled jobs |

> [!IMPORTANT]
> `onboarding@resend.dev` is Resend's **sandbox** sender — it only delivers to
> the Resend account owner. Mail to customers is accepted by the API and then
> silently dropped. The app refuses to send in production while it is
> configured, rather than reporting a false success. Verify a domain in Resend
> and point `RESEND_FROM_EMAIL` at it, or set `ALLOW_SANDBOX_EMAIL_SENDER=1` to
> opt back in for testing.

### Post-setup

Supabase Auth needs the access-token hook enabled so JWTs carry company context:
**Dashboard → Authentication → Hooks → Customize Access Token** →
`public.custom_access_token_hook`.

## Development

```bash
npm run dev        # dev server
npm run verify     # typecheck + lint + tests — run before pushing
npm run build      # production build
```

| Script | |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (zero warnings enforced) |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest, watch mode |

## Project structure

```
src/
├─ app/
│  ├─ (auth)/          Business + customer sign-in and registration
│  ├─ (business)/      The main app — one route segment per feature,
│  │                   each gated by a layout-level role guard
│  ├─ (customer)/      Customer self-service portal
│  ├─ (public)/        Shareable invoice links
│  └─ api/             Webhooks, cron jobs, file exports
├─ components/         Shared UI (shadcn/ui primitives in components/ui)
├─ lib/
│  ├─ actions/         Server Actions — every mutation validated and permission-checked
│  ├─ auth/            Permission model and enforcement
│  ├─ gst/             GSTR-1/2B/3B/9 computation and GSTN export
│  ├─ schemas/         Zod schemas shared by forms and server
│  └─ supabase/        Browser, server and admin clients
└─ types/              Types generated from the database schema
supabase/migrations/   Forward-only, verified against the live database
```

## Testing

420 tests across unit, integration and component suites.

```bash
npm test
```

Coverage is weighted toward the parts where a silent failure is expensive: GST
tax computation, the permission model, invoice totals, and middleware route
coverage — the last of which reads the route directory and fails the build if a
new segment is added without an auth guard.

## Deployment

Deployed on [Vercel](https://vercel.com); pushes to `main` ship automatically.

1. Import the repository into Vercel
2. Add the environment variables above (Production + Preview)
3. Run `npx supabase db push` against the production project

Migrations are forward-only — apply them **before** the code that depends on
them.

## License

Private project. All rights reserved.
