import { createClient } from '@/lib/supabase/server'
import { getTransfers } from '@/lib/actions/transfers'
import { TransfersTable } from './_components/transfers-table'

interface Props {
  searchParams: Promise<{ tab?: string; created?: string }>
}

export default async function TransfersPage(props: Props) {
  const searchParams = await props.searchParams;
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [allResult] = await Promise.all([getTransfers()])

  const allTransfers = 'error' in allResult ? [] : allResult.data

  const pendingTransfers = allTransfers
    .filter((t) => t.status === 'pending')
    .map((t) => ({
      ...t,
      can_approve: t.requested_by !== (user?.id ?? ''),
    }))

  const historyTransfers = allTransfers.filter(
    (t) => t.status === 'approved' || t.status === 'rejected'
  )

  const tab = searchParams.tab ?? 'pending'

  return (
    <TransfersTable
      pendingTransfers={pendingTransfers}
      historyTransfers={historyTransfers}
      currentUserId={user?.id ?? ''}
      tab={tab}
      created={searchParams.created === '1'}
    />
  )
}
