'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// SettingsTabs
// Tab sub-nav with active link detection (usePathname). Every route under
// /settings belongs here — new tabs go in the `tabs` array.
// ─────────────────────────────────────────────────────────────────────────────

const tabs = [
  { href: '/settings/godowns', label: 'Godowns' },
  { href: '/settings/franchise', label: 'Franchise' },
  { href: '/settings/telephony', label: 'Telephony' },
]

export function SettingsTabs() {
  const pathname = usePathname()

  return (
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
  )
}
