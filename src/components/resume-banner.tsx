'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

export function ResumeBanner({ step }: { step: number }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  const nextStep = step + 1
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-4 flex items-center justify-between">
      <div>
        <p className="font-semibold text-amber-800 text-sm">Your setup is incomplete</p>
        <p className="text-sm text-amber-700">
          Finish setting up your account to start creating invoices.{' '}
          <Link
            href={`/onboarding?step=${nextStep}`}
            className="text-amber-900 underline font-medium"
          >
            Continue setup →
          </Link>
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="ml-4 text-amber-600 hover:text-amber-900"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
