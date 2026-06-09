import { MessageSquare } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

// ─────────────────────────────────────────────────────────────────────────────
// WhatsAppOrdersWidget
// Server component — count is prop-fed from RSC dashboard/page.tsx.
// Shows live count of whatsapp_sessions where state = 'invoice_sent'.
// ─────────────────────────────────────────────────────────────────────────────

export interface WhatsAppOrdersWidgetProps {
  /** whatsapp_sessions WHERE state = 'invoice_sent' AND company_id = current */
  count: number
}

export function WhatsAppOrdersWidget({ count }: WhatsAppOrdersWidgetProps) {
  return (
    <Card aria-label={`WhatsApp Orders: ${count}`}>
      <CardHeader className="pb-2">
        <CardDescription className="text-sm text-muted-foreground flex items-center gap-1">
          <MessageSquare className="h-4 w-4" />
          WhatsApp Orders
        </CardDescription>
        <CardTitle className="text-3xl font-bold tabular-nums">
          {count}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={count > 0 ? 'text-xs' : 'text-xs text-muted-foreground'}>
          Invoices sent via WhatsApp
        </p>
      </CardContent>
    </Card>
  )
}
