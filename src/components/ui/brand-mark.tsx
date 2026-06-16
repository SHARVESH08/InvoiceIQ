import Image from 'next/image'
import { cn } from '@/lib/utils'

/** InvoiceIQ emblem badge (cropped from the brand logo). Decorative — pair with a text wordmark or an aria-label on the wrapping link. */
export function BrandMark({
  size = 28,
  priority = false,
  className,
}: {
  size?: number
  priority?: boolean
  className?: string
}) {
  return (
    <Image
      src="/brand/logo-mark.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority={priority}
      className={cn('shrink-0 rounded-lg object-cover ring-1 ring-border/60', className)}
    />
  )
}
