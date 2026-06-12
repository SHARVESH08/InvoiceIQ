import { ReactNode } from 'react'

export function Marquee({ children }: { children: ReactNode }) {
  return (
    <div className="group relative flex overflow-hidden">
      <div className="flex shrink-0 animate-marquee gap-8 pr-8 group-hover:[animation-play-state:paused]">
        {children}
      </div>
      <div
        aria-hidden="true"
        className="flex shrink-0 animate-marquee gap-8 pr-8 group-hover:[animation-play-state:paused]"
      >
        {children}
      </div>
    </div>
  )
}
