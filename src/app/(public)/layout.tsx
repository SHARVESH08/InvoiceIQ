/**
 * Public route group — no session check, no sidebar, no nav.
 * Used by /invoice/[public_id] (PDF-04).
 * Middleware matcher excludes /invoice/* per RESEARCH.md Pattern 5,
 * so no session refresh runs here. (CONTEXT.md D-13)
 */

export const dynamic = 'force-dynamic'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
