export const STATUS_CONFIG = {
  draft:     { label: 'Draft',     className: 'bg-slate-100 text-slate-600 border-slate-200' },
  sent:      { label: 'Sent',      className: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid:      { label: 'Paid',      className: 'bg-green-50 text-green-700 border-green-200' },
  overdue:   { label: 'Overdue',   className: 'bg-orange-50 text-orange-700 border-orange-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
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
