'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { saveOnboardingStep } from '../actions'
import { createClient } from '@/lib/supabase/client'

const TAX_RATES = [0, 5, 12, 18, 28]

interface AddProductStepProps {
  companyId: string
}

export function AddProductStep({ companyId }: AddProductStepProps) {
  const router = useRouter()
  const [productName, setProductName] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [taxRate, setTaxRate] = useState('18')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleAdd() {
    if (!productName.trim() || !sellingPrice) {
      setActionError('Please fill in product name and selling price.')
      return
    }
    setSaving(true)
    setActionError(null)

    try {
      const supabase = createClient()
      const { error: insertError } = await supabase.from('products').insert({
        company_id: companyId,
        name: productName.trim(),
        selling_price: parseFloat(sellingPrice),
        tax_rate: parseInt(taxRate, 10),
      })

      if (insertError) {
        setActionError('Something went wrong saving your product. Please try again.')
        setSaving(false)
        return
      }

      const result = await saveOnboardingStep(3)
      if ('error' in result) {
        setActionError('Something went wrong saving your progress. Please try again.')
        setSaving(false)
        return
      }

      router.push('/onboarding?step=4')
    } catch {
      setActionError('Something went wrong saving your progress. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Card className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Add your first product</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Add at least one product to include it in your first invoice.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="product-name">
            Product Name
          </label>
          <input
            id="product-name"
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. Widget A"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="selling-price">
            Selling Price (&#8377;)
          </label>
          <input
            id="selling-price"
            type="number"
            min="0"
            step="0.01"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="tax-rate">
            Tax Rate (%)
          </label>
          <select
            id="tax-rate"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {TAX_RATES.map((rate) => (
              <option key={rate} value={String(rate)}>
                {rate}%
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionError && (
        <p className="text-sm text-destructive">{actionError}</p>
      )}

      <div className="flex flex-col gap-3">
        <Button variant="default" onClick={handleAdd} disabled={saving}>
          {saving ? 'Adding...' : 'Add Product'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/onboarding?step=2')}>
          Back to Step 2
        </Button>
      </div>
    </Card>
  )
}
