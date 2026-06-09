export default function WhatsAppLoading() {
  return (
    <div
      role="status"
      aria-label="Loading WhatsApp bot setup..."
      className="space-y-6"
    >
      {/* Page heading skeleton */}
      <div className="animate-pulse bg-muted h-7 w-56 rounded" />

      {/* BotSetupCard skeleton */}
      <div className="animate-pulse bg-muted h-40 rounded-md" />

      {/* WhatsAppRealtimeLog skeleton — 3 table row shapes */}
      <div className="space-y-3">
        <div className="animate-pulse bg-muted h-12 rounded" />
        <div className="animate-pulse bg-muted h-12 rounded" />
        <div className="animate-pulse bg-muted h-12 rounded" />
      </div>
    </div>
  )
}
