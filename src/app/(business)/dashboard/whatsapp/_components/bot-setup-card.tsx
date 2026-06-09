'use client'

import { useState } from 'react'
import { Copy, Check, MessageCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QrCodeImage } from './qr-code-image'

interface BotSetupCardProps {
  botCode: string | null
  phoneNumber: string | null   // WhatsApp number (E.164)
  companyName: string
}

export function BotSetupCard({ botCode, phoneNumber, companyName }: BotSetupCardProps) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Build wa.me URL: strip leading '+' from E.164 phone number per spec
  const phone = phoneNumber?.replace(/^\+/, '') ?? null
  const waLink =
    botCode && phone
      ? `https://wa.me/${phone}?text=START-${botCode}`
      : null

  async function handleCopyCode() {
    if (!botCode) return
    await navigator.clipboard.writeText(botCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  async function handleCopyLink() {
    if (!waLink) return
    await navigator.clipboard.writeText(waLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const disabled = botCode === null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold leading-tight">Bot Configuration</CardTitle>
        {companyName && (
          <p className="text-sm text-muted-foreground">{companyName}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {disabled ? (
          <p className="text-sm text-muted-foreground">
            Bot code not yet generated. Contact support.
          </p>
        ) : (
          <>
            {/* Row 1: bot_code */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Your bot code</p>
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm bg-muted px-2 py-1 rounded min-h-[44px] flex items-center flex-1">
                  {botCode}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyCode}
                  aria-label="Copy bot code to clipboard"
                  className="min-h-[44px] px-3"
                >
                  {copiedCode ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Row 2: wa.me link */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Share this link</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1 min-h-[44px] bg-muted px-2 py-1 rounded text-sm truncate">
                  <MessageCircle className="h-4 w-4 shrink-0" style={{ color: '#25D366' }} />
                  <span className="truncate text-sm">{waLink}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyLink}
                  aria-label="Copy WhatsApp link to clipboard"
                  className="min-h-[44px] px-3 shrink-0"
                >
                  {copiedLink ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                {waLink && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="min-h-[44px] shrink-0"
                  >
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open WhatsApp chat (opens in new tab)"
                    >
                      Open in WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* QR code */}
            {waLink && (
              <div className="flex flex-col items-start gap-2">
                <QrCodeImage value={waLink} size={128} />
                <p className="text-xs text-muted-foreground">
                  Scan to open WhatsApp chat
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
