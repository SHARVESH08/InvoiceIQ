'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// SettingsLayout
// Renders a tab sub-nav with active link detection (usePathname).
// Currently exposes only the Godowns tab; future settings tabs can be added
// to the `tabs` array without restructuring this layout.
// ─────────────────────────────────────────────────────────────────────────────

const tabs = [
  { href: '/settings/godowns', label: 'Godowns' },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b mb-6">
        <nav className="flex gap-1 -mb-px">
          {tabs.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                pathname.startsWith(href)
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  )
}
