export const STATUS_CONFIG = {
  draft:     { label: 'Draft',     className: 'bg-muted text-muted-foreground border-border' },
  sent:      { label: 'Sent',      className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  paid:      { label: 'Paid',      className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  overdue:   { label: 'Overdue',   className: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
} as const

type InvoiceStatus = keyof typeof STATUS_CONFIG

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
}
