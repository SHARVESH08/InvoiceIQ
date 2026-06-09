export default function DashboardLoading() {
  return (
    <div aria-label="Loading dashboard...">
      {/* KPI skeleton: 2-col mobile, 4-col desktop — matches KPI grid breakpoints */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
        <div className="animate-pulse bg-muted rounded-md h-[88px]" />
        <div className="animate-pulse bg-muted rounded-md h-[88px]" />
        <div className="animate-pulse bg-muted rounded-md h-[88px]" />
        <div className="animate-pulse bg-muted rounded-md h-[88px]" />
      </div>
      {/* Chart panel skeleton */}
      <div className="animate-pulse bg-muted rounded-md h-[320px] w-full" />
    </div>
  )
}
