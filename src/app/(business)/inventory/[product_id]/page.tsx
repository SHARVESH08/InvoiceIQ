import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getInventoryByProduct } from '@/lib/actions/inventory'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { InventoryStatus } from '@/lib/actions/inventory'

interface Props {
  params: { product_id: string }
}

function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  if (status === 'out_of_stock') {
    return (
      <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30">
        Out of Stock
      </Badge>
    )
  }
  if (status === 'low_stock') {
    return (
      <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">
        Low Stock
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-green-500/15 text-green-400 border-green-500/30">
      OK
    </Badge>
  )
}

export default async function InventoryProductPage({ params }: Props) {
  const { product_id } = params

  const supabase = await createClient()

  // Fetch product details
  const { data: product } = await supabase
    .from('products')
    .select('id, name, hsn_code, unit')
    .eq('id', product_id)
    .single()

  if (!product) {
    notFound()
  }

  // Fetch per-godown breakdown
  const result = await getInventoryByProduct(product_id)
  const rows = 'error' in result ? [] : result.data

  // Fetch pending transfers affecting this product
  const { data: pendingTransfers } = await supabase
    .from('stock_transfers')
    .select(
      `
      id,
      qty,
      requested_by,
      from_godown_id,
      to_godown_id,
      from_godown:godowns!stock_transfers_from_godown_id_fkey(name),
      to_godown:godowns!stock_transfers_to_godown_id_fkey(name)
    `
    )
    .eq('product_id', product_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const hasPendingTransfers = (pendingTransfers ?? []).length > 0

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/inventory">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Inventory
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
        <p className="text-sm text-muted-foreground">
          {product.hsn_code ? `HSN: ${product.hsn_code} · ` : ''}Unit: {product.unit}
        </p>
      </div>

      {/* ── Godown breakdown table ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Stock by Godown</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No stock records for this product.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Godown</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.godown_id}>
                    <TableCell className="font-medium">
                      {row.godown_name}
                      {row.is_default && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Default
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.qty}</TableCell>
                    <TableCell
                      className="text-right tabular-nums text-amber-400"
                      title="Qty locked in pending transfer requests"
                    >
                      {row.reserved}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {row.available}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.reorder_level}
                    </TableCell>
                    <TableCell>
                      <InventoryStatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Pending transfers card (only when transfers exist) ──────────── */}
      {hasPendingTransfers && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Pending Transfers</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm space-y-2">
            {(pendingTransfers ?? []).map((t) => {
              const fromGodown = Array.isArray(t.from_godown)
                ? t.from_godown[0]
                : t.from_godown
              const toGodown = Array.isArray(t.to_godown)
                ? t.to_godown[0]
                : t.to_godown
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <span>
                    {fromGodown?.name ?? '—'} → {toGodown?.name ?? '—'}
                  </span>
                  <span className="tabular-nums text-amber-400">
                    {t.qty} {product.unit}
                  </span>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/inventory/transfers">View</Link>
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
