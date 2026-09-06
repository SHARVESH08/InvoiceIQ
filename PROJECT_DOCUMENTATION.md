# InvoiceIQ — Centralized Billing & Inventory Management System

**Project Documentation — Full Stack Overview**
*(Prepared for Internship / Mini Project Certification)*

---

## 1. Project Summary

InvoiceIQ is a full-stack, multi-tenant SaaS platform for small and medium businesses to manage billing, GST-compliant invoicing, inventory, customers, and sales operations (CRM) from a single dashboard. It supports multi-company franchise hierarchies, WhatsApp-based customer notifications, telephony-based CRM calling, and payment collection via Razorpay.

- **Repository:** https://github.com/SHARVESH08/InvoiceIQ
- **Live Deployment:** Vercel (production)
- **Architecture:** Full-stack monolith using Next.js App Router (frontend + backend co-located), PostgreSQL via Supabase (database + auth), deployed on Vercel with CI/CD from GitHub.

---

## 2. Team-wise Technical Breakdown

### 2.1 Frontend Team

| Aspect | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components) |
| UI Library | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 3 |
| Component System | shadcn/ui (built on Radix UI primitives — Dialog, Select, Tabs, Switch, Alert Dialog, Label) |
| Forms & Validation | React Hook Form + Zod schema validation |
| Animation | Framer Motion |
| Charts / Analytics UI | Recharts |
| Icons | Lucide React |
| Notifications (toast) | Sonner |
| PDF Rendering | @react-pdf/renderer (client-side invoice/PDF generation) |

**Responsibilities:**
- Responsive, mobile-first dashboard UI (billing, inventory, CRM, franchise views)
- Route groups for distinct user journeys: `(auth)`, `(business)`, `(customer)`, `(onboarding)`, `(public)`
- Client-side form validation mirrored with backend Zod schemas
- Dark-themed design system ("Midnight Gold") with consistent typography and component tokens
- Dynamic imports and code-splitting for performance optimization

---

### 2.2 Backend Team

| Aspect | Technology |
|---|---|
| Runtime | Node.js (via Next.js API Routes & Server Actions) |
| API Style | REST-style route handlers under `src/app/api/*` |
| Validation | Zod (shared schemas between client and server) |
| Authentication | Supabase Auth (JWT-based, custom `company_role` claim via auth hook for multi-tenant RBAC) |
| Third-party Integrations | Razorpay (payments), Resend (transactional email), Exotel (click-to-call + call recording), Groq SDK (LLM-backed chat/insights), WhatsApp Business API (customer messaging) |
| File/Data Processing | PapaParse & SheetJS/xlsx (CSV/Excel import-export), qrcode (UPI/payment QR generation) |
| Scheduled Jobs | Vercel Cron routes (`api/cron`) for recurring billing/reporting tasks |

**Key API modules (`src/app/api/`):**
- `invoice/` — invoice generation, GST calculation, PDF export
- `gst/` — GST compliance and tax computation
- `telephony/` — Exotel webhook handling, call logging
- `whatsapp/` — WhatsApp webhook + notification delivery
- `chat/` — AI-assisted chat/insights (Groq)
- `cron/` — scheduled background jobs

**Responsibilities:**
- Multi-tenant business logic with company-level data isolation
- Server-side validation and authorization on every mutation
- Webhook handling for third-party services (Exotel, WhatsApp, Razorpay)
- Revenue/COGS accounting logic (GST-exclusive taxable-amount standardization)

---

### 2.3 Database Team

| Aspect | Technology |
|---|---|
| Database Engine | PostgreSQL (managed via Supabase) |
| Access Layer | Supabase JS Client (`@supabase/supabase-js`, `@supabase/ssr`) |
| Security Model | Row-Level Security (RLS) policies enforcing company-level multi-tenancy |
| Schema Management | Versioned SQL migrations in `supabase/migrations/` (39+ migrations) |
| Extensions | `pgcrypto` (schema-qualified under `extensions`) for secure token generation |

**Core schema domains:**
- Companies, users, and role-based access (`company_role` JWT claim)
- Products, inventory, and stock movement (with `purchase_price` for COGS)
- Invoices, customers, and GST-compliant billing records
- Franchise HQ hierarchy (parent-child company relationships, group invites)
- CRM tables: leads, deals (kanban pipeline), follow-ups
- Telephony tables: `telephony_settings` (admin-only), `telephony_agents`, `crm_calls` (call history/recordings)

**Responsibilities:**
- Designing RLS policies to guarantee tenant data isolation
- Writing and validating forward-only migrations before deploying to production
- Ensuring schema-to-application-layer parity (e.g., Zod schemas matching DB columns)

---

### 2.4 DevOps / Deployment Team

| Aspect | Technology |
|---|---|
| Hosting / Deployment | Vercel (automatic CI/CD on push to `main`) |
| Database Hosting | Supabase (managed Postgres + Auth + Storage) |
| Version Control | Git & GitHub (feature-branch workflow, PR-based merges) |
| Environment Config | Vercel Environment Variables (`.env.local` for local dev) |
| Testing | Vitest + React Testing Library (jsdom/node dual-environment split) |
| Linting | ESLint 9 (flat config) |

**Responsibilities:**
- Production deployment pipeline: push → Vercel build → live deployment
- Environment/secret management across local, preview, and production
- Database migration deployment via Supabase CLI (`supabase db push`)
- Automated test suite execution pre-merge (component + unit tests)

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Client (Browser)                     │
│         Next.js 16 + React 19 + Tailwind + shadcn/ui       │
└───────────────────────────┬───────────────────────────────┘
                             │ HTTPS
┌───────────────────────────▼───────────────────────────────┐
│              Next.js App Router (Vercel Functions)         │
│   Server Components · Server Actions · API Route Handlers  │
│   Zod Validation · Auth Middleware · Business Logic         │
└─────┬───────────────┬──────────────┬────────────┬──────────┘
      │               │              │            │
      ▼               ▼              ▼            ▼
 ┌─────────┐    ┌───────────┐  ┌───────────┐ ┌───────────┐
 │ Supabase│    │ Razorpay  │  │  Exotel    │ │ WhatsApp/  │
 │ Postgres│    │ (Payments)│  │(Telephony) │ │ Resend     │
 │ + Auth  │    │           │  │            │ │(Notify)    │
 └─────────┘    └───────────┘  └───────────┘ └───────────┘
```

---

## 4. Core Features Delivered

- GST-compliant invoicing with PDF generation
- Real-time inventory tracking with COGS calculation
- Multi-tenant franchise hierarchy (HQ + branch companies)
- CRM: lead/deal pipeline, follow-ups, click-to-call, call recording
- WhatsApp-based customer notifications
- Razorpay payment collection with QR codes
- Role-based access control via JWT custom claims
- Responsive dashboard with performance-optimized dynamic imports

---

## 5. Repository & Deployment Links

| Resource | Link |
|---|---|
| GitHub Repository | https://github.com/SHARVESH08/InvoiceIQ |
| Live Production App | Deployed via Vercel (linked to `main` branch) |

---

*This document reflects the technical stack and architecture as of the latest deployment on the `main` branch.*
