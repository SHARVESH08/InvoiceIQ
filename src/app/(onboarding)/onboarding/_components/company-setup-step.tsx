'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { saveOnboardingStep } from '../actions'

interface CompanySetupStepProps {
  companyId: string
}

export function CompanySetupStep({ companyId: _companyId }: CompanySetupStepProps) {
  const router = useRouter()
  const [companyName, setCompanyName] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setActionError(null)
    const result = await saveOnboardingStep(2)
    setSaving(false)
    if ('error' in result) {
      setActionError('Something went wrong saving your progress. Please try again.')
      return
    }
    router.push('/onboarding?step=3')
  }

  return (
    <Card className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Set up your company</h1>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="company-name">
            Company Name
          </label>
          <input
            id="company-name"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Your Company Pvt. Ltd."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="state-code">
            State Code
          </label>
          <input
            id="state-code"
            type="text"
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            placeholder="e.g. 29"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="address">
            Address
          </label>
          <textarea
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Business Park, City"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>
      </div>

      {actionError && (
        <p className="text-sm text-destructive">{actionError}</p>
      )}

      <div className="flex flex-col gap-3">
        <Button variant="default" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save & Continue'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/onboarding?step=1')}>
          Back to Step 1
        </Button>
      </div>
    </Card>
  )
}
