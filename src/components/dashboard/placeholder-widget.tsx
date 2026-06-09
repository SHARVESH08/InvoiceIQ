'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export interface PlaceholderWidgetProps {
  /** Category label (12px/400) */
  label: string
  /** Explanatory note for the placeholder (text-xs text-muted-foreground) */
  note: string
}

/**
 * PlaceholderWidget — non-interactive card showing "0" in muted text with a coming-soon note.
 *
 * Used for PO count (OEM) and WhatsApp Orders (Retailer).
 * No hover state, no cursor-pointer per UI-SPEC interaction contract.
 * aria-disabled="true" per UI-SPEC accessibility notes.
 */
export function PlaceholderWidget({ label, note }: PlaceholderWidgetProps) {
  return (
    <Card aria-disabled="true">
      <CardHeader className="pb-2">
        <CardDescription className="text-sm text-muted-foreground">
          {label}
        </CardDescription>
        <CardTitle className="text-3xl font-bold text-muted-foreground">
          0
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  )
}
