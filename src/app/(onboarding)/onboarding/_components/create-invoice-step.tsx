'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { completeOnboarding } from '../actions'

interface CreateInvoiceStepProps {
  companyId: string
}

export function CreateInvoiceStep({ companyId: _companyId }: CreateInvoiceStepProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleFinish() {
    setLoading(true)
    setActionError(null)
    const result = await completeOnboarding()
    if ('error' in result) {
      setActionError('Something went wrong saving your progress. Please try again.')
      setLoading(false)
      return
    }
    router.push('/invoices/new?onboarding=true')
  }

  return (
    <Card className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Create your first invoice</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Your invoice will be saved as a draft. You can complete and send it from the invoices
          page.
        </p>
      </div>

      {actionError && (
        <p className="text-sm text-destructive">{actionError}</p>
      )}

      <div className="flex flex-col gap-3">
        <Button variant="default" onClick={handleFinish} disabled={loading}>
          {loading ? 'Finishing...' : 'Create Invoice & Finish Setup'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/onboarding?step=3')}>
          Back to Step 3
        </Button>
      </div>
    </Card>
  )
}
