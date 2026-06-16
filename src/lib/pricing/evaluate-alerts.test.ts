import { describe, it, expect } from 'vitest'
import { evaluateProductAlerts, type MonitoredProduct } from './evaluate-alerts'

const p = (over: Partial<MonitoredProduct>): MonitoredProduct => ({
  company_id: 'co1', product_id: 'p1', name: 'Item', category: 'Steel', selling_price: 100, ...over,
})

describe('evaluateProductAlerts', () => {
  it('flags a product whose price deviates more than the threshold', () => {
    const out = evaluateProductAlerts([p({ selling_price: 100 })], { Steel: 130 })
    expect(out.get('co1')).toHaveLength(1)
    expect(out.get('co1')![0].name).toBe('Item')
  })

  it('ignores products within threshold', () => {
    const out = evaluateProductAlerts([p({ selling_price: 100 })], { Steel: 105 })
    expect(out.size).toBe(0)
  })

  it('skips products with no market price for their category or zero price', () => {
    const out = evaluateProductAlerts(
      [p({ category: 'Unknown' }), p({ product_id: 'p2', selling_price: 0 })],
      { Steel: 130 },
    )
    expect(out.size).toBe(0)
  })

  it('groups multiple flagged products by company', () => {
    const out = evaluateProductAlerts(
      [p({ product_id: 'p1' }), p({ product_id: 'p2', name: 'Rod' })],
      { Steel: 200 },
    )
    expect(out.get('co1')).toHaveLength(2)
  })
})
