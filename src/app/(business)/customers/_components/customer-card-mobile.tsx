'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'

interface Customer {
  id: string
  name: string
  customer_type: string
  gstin: string | null
  phone: string | null
  email: string | null
  state_code: string | null
  credit_limit: number
  billing_address: { street: string; city: string; pincode: string } | null
  shipping_address: { street: string; city: string; pincode: string } | null
  customer_profile_id: string | null
  company_id: string
  created_at: string
  updated_at: string
}

interface CustomerCardMobileProps {
  customer: Customer
}

export function CustomerCardMobile({ customer }: CustomerCardMobileProps) {
  const secondaryLeft =
    customer.billing_address?.city ?? customer.phone ?? '—'

  return (
    <Link href={`/customers/${customer.id}/edit`}>
      <Card className="px-4 py-3 cursor-pointer active:bg-secondary min-h-[64px] active:scale-[0.99] transition-transform">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">{customer.name}</span>
          <span className="text-xs text-muted-foreground uppercase">
            {customer.customer_type}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">{secondaryLeft}</span>
          {customer.phone && customer.billing_address?.city && (
            <span className="text-xs text-muted-foreground">{customer.phone}</span>
          )}
        </div>
      </Card>
    </Link>
  )
}
