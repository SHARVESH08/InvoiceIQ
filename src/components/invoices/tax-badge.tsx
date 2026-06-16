'use client'

export type TaxType = 'intra' | 'inter' | 'unknown'

interface TaxTypeBadgeProps {
  taxType: TaxType
}

export function TaxTypeBadge({ taxType }: TaxTypeBadgeProps) {
  if (taxType === 'intra') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 px-3 py-1 text-xs font-medium text-blue-400">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
        Intra-state · CGST + SGST
      </div>
    )
  }
  if (taxType === 'inter') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 px-3 py-1 text-xs font-medium text-orange-400">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        Inter-state · IGST
      </div>
    )
  }
  // unknown — no customer selected yet
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      Select a customer to determine tax type
    </div>
  )
}
