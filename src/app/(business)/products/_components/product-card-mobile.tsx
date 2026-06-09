'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'

interface Product {
  id: string
  name: string
  hsn_code: string | null
  category: string | null
  unit: string
  selling_price: number
  tax_rate: number
  purchase_price: number
  reorder_level: number
  description: string | null
  company_id: string
  created_at: string
  updated_at: string
}

interface ProductCardMobileProps {
  product: Product
}

export function ProductCardMobile({ product }: ProductCardMobileProps) {
  return (
    <Link href={`/products/${product.id}/edit`}>
      <Card className="px-4 py-3 cursor-pointer active:bg-secondary min-h-[64px] active:scale-[0.99] transition-transform">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">{product.name}</span>
          <span className="text-sm font-semibold">₹{Number(product.selling_price).toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {product.category ?? product.unit}
          </span>
          <span className="text-xs text-muted-foreground">{product.unit}</span>
        </div>
      </Card>
    </Link>
  )
}
