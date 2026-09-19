'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { GstrTabs } from './gstr-tabs'

interface PeriodRow {
  id: string
  period_type: string
  fy: string
  period: string
  status: string
}

interface CompanyRow {
  gstin: string | null
  name: string
  state_code: string | null
}

interface GstPeriodSelectorProps {
  companyId: string
  periods: PeriodRow[]
  company: CompanyRow | null
}

// Apr→Mar order per GST financial year convention
const FY_MONTHS = [
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
]

const FY_OPTIONS = ['2025-26', '2024-25', '2023-24', '2022-23']

export function GstPeriodSelector({ companyId, periods, company: _company }: GstPeriodSelectorProps) {
  const [fy, setFy] = useState<string>('2025-26')
  const [period, setPeriod] = useState<string>('04')

  const matchedPeriodRow = periods.find(
    (p) => p.fy === fy && p.period === period && p.period_type === 'GSTR-1'
  )
  const status = matchedPeriodRow?.status ?? 'draft'

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Filing Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Financial Year</p>
              <Select value={fy} onValueChange={setFy}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FY_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Month</p>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FY_MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {status === 'filed' && (
              <div className="flex items-end">
                <span className="inline-flex items-center rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
                  Filed
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <GstrTabs
        companyId={companyId}
        fy={fy}
        period={period}
        status={status}
        periods={periods}
      />
    </div>
  )
}
