'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

export function ResumeBanner({ step }: { step: number }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  const nextStep = step + 1
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Your setup is incomplete</p>
        <p className="text-sm text-muted-foreground">
          Finish setting up your account to start creating invoices.{' '}
          <Link href={`/onboarding?step=${nextStep}`} className="font-medium text-primary underline">
            Continue setup →
          </Link>
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="ml-4 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
