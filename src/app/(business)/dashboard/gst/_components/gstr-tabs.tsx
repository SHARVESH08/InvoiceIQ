'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Gstr1Tab } from './gstr1-tab'
import { Gstr3bTab } from './gstr3b-tab'
import { Gstr9Tab } from './gstr9-tab'
import { Gstr2bTab } from './gstr2b-tab'

interface PeriodRow {
  id: string
  period_type: string
  fy: string
  period: string
  status: string
}

interface GstrTabsProps {
  companyId: string
  fy: string
  period: string
  status: string
  periods: PeriodRow[]
}

export function GstrTabs({ companyId, fy, period, status, periods }: GstrTabsProps) {
  const getStatus = (periodType: string, p: string = period) =>
    periods.find((r) => r.fy === fy && r.period === p && r.period_type === periodType)?.status ?? 'draft'

  const gstr9Status = periods.find((r) => r.fy === fy && r.period_type === 'GSTR-9')?.status ?? 'draft'

  return (
    <Tabs defaultValue="gstr1">
      <TabsList className="mb-2">
        <TabsTrigger value="gstr1">GSTR-1</TabsTrigger>
        <TabsTrigger value="gstr3b">GSTR-3B</TabsTrigger>
        <TabsTrigger value="gstr9">GSTR-9</TabsTrigger>
        <TabsTrigger value="gstr2b">GSTR-2B</TabsTrigger>
      </TabsList>

      <TabsContent value="gstr1">
        <Gstr1Tab
          companyId={companyId}
          fy={fy}
          period={period}
          status={getStatus('GSTR-1')}
        />
      </TabsContent>

      <TabsContent value="gstr3b">
        <Gstr3bTab
          companyId={companyId}
          fy={fy}
          period={period}
          status={getStatus('GSTR-3B')}
        />
      </TabsContent>

      <TabsContent value="gstr9">
        <Gstr9Tab
          companyId={companyId}
          fy={fy}
          status={gstr9Status}
        />
      </TabsContent>

      <TabsContent value="gstr2b">
        <Gstr2bTab
          companyId={companyId}
          fy={fy}
          period={period}
          status={getStatus('GSTR-2B')}
        />
      </TabsContent>
    </Tabs>
  )
}
