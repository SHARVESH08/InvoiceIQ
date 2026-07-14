import { getTelephonyStatus, listRecentCalls } from '@/lib/actions/telephony'
import { CredentialsForm } from './_components/credentials-form'
import { AgentPhoneForm } from './_components/agent-phone-form'
import { RecentCallsList } from './_components/recent-calls-list'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// Settings > Telephony — Exotel credentials (admin), the user's agent phone,
// and recent calls with recording playback.
// ─────────────────────────────────────────────────────────────────────────────

export default async function TelephonySettingsPage() {
  const [status, calls] = await Promise.all([getTelephonyStatus(), listRecentCalls(20)])

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Telephony</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Free mode is always on: Call buttons open your phone&apos;s dialer at
          no cost, with one-tap call logging. Connect an Exotel account below
          to upgrade to bridged calls with automatic logging and recordings on
          the customer timeline.
        </p>
      </div>

      <AgentPhoneForm currentPhone={status.agent_phone} />

      <CredentialsForm
        configured={status.configured}
        accountSidMasked={status.account_sid_masked}
        virtualNumber={status.virtual_number}
        recordCalls={status.record_calls}
      />

      <RecentCallsList calls={calls} />

      <p className="text-xs text-muted-foreground">
        Recording note: Indian regulations require callers to be informed that
        the call is recorded — enable the recording disclosure on your Exotel
        flow. Recordings are streamed through InvoiceIQ with your credentials;
        they are never exposed publicly.
      </p>
    </div>
  )
}
