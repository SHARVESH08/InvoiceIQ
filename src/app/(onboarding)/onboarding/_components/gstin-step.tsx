'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { saveOnboardingStep } from '../actions'

interface GstinStepProps {
  companyId: string
}

export function GstinStep({ companyId: _companyId }: GstinStepProps) {
  const router = useRouter()
  const [gstin, setGstin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [verified, setVerified] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleVerify() {
    if (!gstin || gstin.length !== 15) {
      setError("We couldn't verify this GSTIN. Check the number and try again.")
      return
    }
    setVerifying(true)
    setError(null)
    try {
      const res = await fetch(`/api/gstin-validate?gstin=${encodeURIComponent(gstin)}`)
      const json = await res.json()
      if (!res.ok || json.error) {
        setError("We couldn't verify this GSTIN. Check the number and try again.")
        setVerified(false)
      } else {
        setVerified(true)
        setError(null)
      }
    } catch {
      setError("We couldn't verify this GSTIN. Check the number and try again.")
    } finally {
      setVerifying(false)
    }
  }

  async function handleContinue() {
    if (!verified) {
      await handleVerify()
      return
    }
    setSaving(true)
    setActionError(null)
    const result = await saveOnboardingStep(1)
    setSaving(false)
    if ('error' in result) {
      setActionError('Something went wrong saving your progress. Please try again.')
      return
    }
    router.push('/onboarding?step=2')
  }

  return (
    <Card className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Let&apos;s verify your business</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Enter your GSTIN to auto-fill your company details from the GST portal.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="gstin">
          GSTIN
        </label>
        <input
          id="gstin"
          type="text"
          maxLength={15}
          value={gstin}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          onBlur={handleVerify}
          placeholder="e.g. 22AAAAA0000A1Z5"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {verified && (
          <p className="text-sm text-green-400">GSTIN verified successfully.</p>
        )}
      </div>

      {actionError && (
        <p className="text-sm text-destructive">{actionError}</p>
      )}

      <div className="flex flex-col gap-3">
        <Button variant="default" onClick={handleContinue} disabled={verifying || saving}>
          {verifying ? 'Verifying...' : saving ? 'Saving...' : 'Verify GSTIN'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    </Card>
  )
}
