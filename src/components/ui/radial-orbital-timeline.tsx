'use client'

import { useState, useEffect, useRef } from 'react'
import { type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface OrbitItem {
  id: number
  title: string
  description: string
  icon: LucideIcon
}

export function RadialOrbitalTimeline({ items }: { items: OrbitItem[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [rotation, setRotation] = useState(0)
  const [autoRotate, setAutoRotate] = useState(true)
  // Responsive orbit radius. Initial value is deterministic (matches SSR), then
  // shrunk to fit narrow viewports after mount — no hydration mismatch.
  const [radius, setRadius] = useState(240)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const measure = () => {
      const w = containerRef.current?.offsetWidth ?? 768
      // Leave room for the node (~76px) + its label on each side.
      setRadius(Math.max(130, Math.min(240, Math.round(w / 2 - 90))))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    if (!autoRotate) return
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const t = setInterval(() => setRotation((p) => (p + 0.3) % 360), 50)
    return () => clearInterval(t)
  }, [autoRotate])

  const toggle = (id: number) => {
    setExpanded((cur) => {
      const next = cur === id ? null : id
      setAutoRotate(next === null)
      return next
    })
  }

  const nodePos = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotation) % 360
    const rad = (angle * Math.PI) / 180
    const x = radius * Math.cos(rad)
    const y = radius * Math.sin(rad)
    const z = Math.round(100 + 50 * Math.cos(rad))
    const opacity = Math.max(0.65, Math.min(1, 0.65 + 0.35 * ((1 + Math.sin(rad)) / 2)))
    // Round so SSR and client emit identical style strings (avoids float hydration mismatch).
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), z, opacity: Number(opacity.toFixed(3)) }
  }

  return (
    <div
      ref={containerRef}
      className="relative mx-auto flex w-full max-w-4xl items-center justify-center overflow-visible"
      style={{ height: radius * 2 + 220 }}
      onClick={(e) => {
        if (e.target === containerRef.current) {
          setExpanded(null)
          setAutoRotate(true)
        }
      }}
    >
      <div className="absolute flex items-center justify-center" style={{ perspective: '1000px' }}>
        <div className="absolute z-10 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-amber-600 animate-pulse">
          <div className="absolute h-24 w-24 animate-ping rounded-full border border-primary/30 opacity-70" />
          <span className="font-display text-base font-bold text-primary-foreground">IQ</span>
        </div>

        <div
          className="absolute rounded-full border border-border"
          style={{ height: radius * 2, width: radius * 2 }}
        />

        {items.map((item, i) => {
          const pos = nodePos(i, items.length)
          const isOpen = expanded === item.id
          const Icon = item.icon
          return (
            <div
              key={item.id}
              className="absolute cursor-pointer transition-all duration-700"
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                zIndex: isOpen ? 200 : pos.z,
                opacity: isOpen ? 1 : pos.opacity,
              }}
              onClick={(e) => {
                e.stopPropagation()
                toggle(item.id)
              }}
            >
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  isOpen
                    ? 'scale-125 border-primary bg-primary text-primary-foreground shadow-[0_0_24px_-4px_hsl(var(--primary)/0.8)]'
                    : 'border-border bg-card text-foreground hover:border-primary/60'
                }`}
              >
                <Icon className="h-7 w-7" />
              </div>
              <div
                className={`absolute left-1/2 top-[72px] -translate-x-1/2 whitespace-nowrap text-sm font-medium transition-all ${
                  isOpen ? 'text-primary' : 'text-foreground'
                }`}
              >
                {item.title}
              </div>
              {isOpen && (
                <Card className="absolute left-1/2 top-28 w-80 -translate-x-1/2 border-border bg-card/95 p-2 shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.45)] backdrop-blur-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-base leading-relaxed text-muted-foreground">{item.description}</CardContent>
                </Card>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
