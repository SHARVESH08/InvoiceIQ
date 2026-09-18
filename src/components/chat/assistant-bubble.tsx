'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Maximize2, MessageCircle, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ChatPanel } from './chat-panel'

// ─────────────────────────────────────────────────────────────────────────────
// AssistantBubble
// The AI assistant's home across the business app: a floating action button in
// the bottom-right that opens the chat panel in place.
//
// ChatPanel is only mounted while open, so its conversation state resets on
// close. That's the same session-only behaviour the full page has always had.
// ─────────────────────────────────────────────────────────────────────────────

const FULL_PAGE_PATH = '/dashboard/chat'

export function AssistantBubble() {
  const pathname = usePathname()
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Store WHERE the panel was opened rather than a bare boolean. Navigating
  // makes openedOn !== pathname, so the overlay collapses on route change
  // without an effect that writes state during render.
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  const open = openedOn === pathname

  function close() {
    setOpenedOn(null)
    triggerRef.current?.focus()
  }

  // Close on Escape, returning focus to the trigger.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenedOn(null)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Redundant on the full page — one assistant on screen, not two.
  if (pathname === FULL_PAGE_PATH) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="AI business assistant"
          className={cn(
            'w-[min(24rem,calc(100vw-2rem))] rounded-lg border bg-card shadow-2xl',
            'animate-in fade-in slide-in-from-bottom-2 duration-150'
          )}
        >
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">AI Assistant</p>
              <p className="truncate text-xs text-muted-foreground">
                Sales, stock, invoices and GST
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={FULL_PAGE_PATH}
                aria-label="Open assistant in full page"
                title="Open in full page"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Maximize2 className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={close}
                aria-label="Close assistant"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <ChatPanel
            showHeader={false}
            scrollAreaClassName="h-[22rem]"
            className="border-0 bg-transparent shadow-none"
          />
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpenedOn(open ? null : pathname)}
        aria-expanded={open}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full shadow-lg',
          'bg-primary text-primary-foreground transition-transform',
          'hover:scale-105 focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  )
}
