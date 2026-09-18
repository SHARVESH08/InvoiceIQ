'use client'

import { useState, useRef, useEffect, type FormEvent } from 'react'
import { sendChatMessage } from '@/lib/actions/chat'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  source?: 'rule' | 'groq'
}

const SUGGESTIONS = [
  {
    label: 'Sales',
    items: ["What are today's sales?", 'Sales this month', 'Revenue YTD', 'Total sales'],
  },
  {
    label: 'Invoices',
    items: ['Show overdue invoices', 'How many unpaid invoices?'],
  },
  {
    label: 'Payments',
    items: ['Pending payments', 'Outstanding balance for Ravi Kumar'],
  },
  {
    label: 'Inventory',
    items: ['Low stock items', 'Top selling products', 'How many units of Rice do I have?', 'Do I have Sugar in stock?'],
  },
  {
    label: 'Customers',
    items: ['Balance for Ravi Kumar', 'Outstanding balance for John'],
  },
  {
    label: 'GST',
    items: ['GSTR-1 deadline', 'GSTR-3B deadline', 'GSTR-9 due date'],
  },
]

interface ChatPanelProps {
  /** Hidden in the floating bubble, which supplies its own title bar. */
  showHeader?: boolean
  /** Tailwind max-height for the scroll region. The bubble needs a fixed one. */
  scrollAreaClassName?: string
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatPanel — client component
// Messages are session-only React state (not persisted to DB).
// Rendered in two shells: the full /dashboard/chat page and the floating
// AssistantBubble. The props exist only to let the bubble drop the header and
// pin the scroll height — the conversation itself is identical in both.
// ─────────────────────────────────────────────────────────────────────────────
export function ChatPanel({
  showHeader = true,
  scrollAreaClassName = 'max-h-[60vh]',
  className,
}: ChatPanelProps = {}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isLoading) return
    const trimmed = input.trim()
    if (!trimmed) return
    await send(trimmed)
  }

  async function send(text: string) {
    setShowSuggestions(false)
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)
    setInput('')

    const result = await sendChatMessage(text)

    setMessages((prev) => [
      ...prev,
      'error' in result
        ? { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${result.error}` }
        : { id: crypto.randomUUID(), role: 'assistant', content: result.reply, source: result.source },
    ])
    setIsLoading(false)
  }

  const isEmpty = messages.length === 0 && !isLoading

  return (
    <Card className={cn('flex flex-col', className)}>
      {showHeader && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Chat with your business data</CardTitle>
        </CardHeader>
      )}

      <CardContent className="flex-1 overflow-hidden p-4">
        <div className={cn('overflow-y-auto space-y-3 pr-1', scrollAreaClassName)}>

          {/* ── Empty state: suggestion grid ─────────────────────────────── */}
          {isEmpty && (
            <div className="py-4 space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Ask anything about your business — or pick a suggestion below.
              </p>
              {SUGGESTIONS.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="text-sm px-4 py-2 rounded-full border bg-background hover:bg-muted transition-colors text-left font-medium"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Messages ─────────────────────────────────────────────────── */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                )}
              >
                <p className="whitespace-pre-line">{msg.content}</p>
                {msg.role === 'assistant' && msg.source && (
                  <div className="mt-1">
                    <SourceBadge source={msg.source} />
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-muted text-muted-foreground">
                Thinking...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </CardContent>

      {/* ── Suggestions popover (during chat) ──────────────────────────────── */}
      {!isEmpty && showSuggestions && (
        <div className="px-4 pb-2 border-t pt-3 space-y-2">
          {SUGGESTIONS.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-sm px-3.5 py-1.5 rounded-full border bg-background hover:bg-muted transition-colors font-medium"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CardFooter className="pt-0 pb-4 px-4">
        <div className="flex w-full flex-col gap-2">
          {!isEmpty && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowSuggestions((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSuggestions ? 'Hide suggestions ↑' : 'Show suggestions ↓'}
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex w-full gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about sales, stock, invoices or GST..."
              disabled={isLoading}
              className="flex-1"
              aria-label="Chat message input"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              Send
            </Button>
          </form>
        </div>
      </CardFooter>
    </Card>
  )
}

function SourceBadge({ source }: { source: 'rule' | 'groq' }) {
  return (
    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 font-normal">
      {source === 'rule' ? 'Smart Match' : 'AI'}
    </Badge>
  )
}
