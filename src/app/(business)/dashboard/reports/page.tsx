'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PnlTab } from './_components/pnl-tab'
import { HsnSummaryTab } from './_components/hsn-summary-tab'
import { ExportTab } from './_components/export-tab'
import { TallyImportTab } from './_components/tally-import-tab'

function getDefaultFrom(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function getDefaultTo(): string {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

export default function ReportsPage() {
  const [from, setFrom] = useState<string>(getDefaultFrom)
  const [to, setTo] = useState<string>(getDefaultTo)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold leading-tight">Reports</h1>

      {/* Date range picker */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Report Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-row gap-4 items-end flex-wrap">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">From</p>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">To</p>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </div>
            <p className="text-xs text-muted-foreground pb-1">
              Applies to P&amp;L and HSN Summary tabs.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="pl">
        <TabsList className="mb-2">
          <TabsTrigger value="pl">P&amp;L</TabsTrigger>
          <TabsTrigger value="hsn">HSN Summary</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="tally">Tally Import</TabsTrigger>
        </TabsList>

        <TabsContent value="pl">
          <PnlTab from={from} to={to} />
        </TabsContent>

        <TabsContent value="hsn">
          <HsnSummaryTab from={from} to={to} />
        </TabsContent>

        <TabsContent value="export">
          <ExportTab from={from} to={to} />
        </TabsContent>

        <TabsContent value="tally">
          <TallyImportTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
