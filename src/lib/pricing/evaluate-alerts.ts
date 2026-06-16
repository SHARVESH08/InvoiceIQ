export interface MonitoredProduct {
  company_id: string
  product_id: string
  name: string
  category: string
  selling_price: number
}

export interface ProductAlert {
  name: string
  category: string
  companyPrice: number
  marketAvg: number
  deltaPct: number // absolute % difference
}

/**
 * Pure cron decision logic. For each monitored product, compare its selling
 * price to the market average for its category; collect products whose
 * deviation exceeds `threshold` (default 10%), grouped by company.
 */
export function evaluateProductAlerts(
  products: MonitoredProduct[],
  marketAvgByCategory: Record<string, number>,
  threshold = 0.1,
): Map<string, ProductAlert[]> {
  const byCompany = new Map<string, ProductAlert[]>()
  for (const p of products) {
    const marketAvg = marketAvgByCategory[p.category]
    if (marketAvg == null || !(p.selling_price > 0)) continue
    const delta = Math.abs(marketAvg - p.selling_price) / p.selling_price
    if (delta <= threshold) continue
    const arr = byCompany.get(p.company_id) ?? []
    arr.push({
      name: p.name,
      category: p.category,
      companyPrice: p.selling_price,
      marketAvg,
      deltaPct: delta * 100,
    })
    byCompany.set(p.company_id, arr)
  }
  return byCompany
}
