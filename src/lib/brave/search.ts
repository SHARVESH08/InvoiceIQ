import 'server-only'

export interface BraveWebResult {
  title: string
  url: string
  description: string
  extra_snippets?: string[]
}

interface BraveSearchResponse {
  web?: {
    results?: BraveWebResult[]
  }
}

// Source pattern only — NOT a /g literal to avoid stale lastIndex (RESEARCH.md Pitfall 4)
const PRICE_REGEX = '(?:₹|rs\\.?|inr)\\s*([\\d,]+(?:\\.\\d+)?)'

export async function searchBrave(query: string, count = 10): Promise<BraveWebResult[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', String(count))
  url.searchParams.set('country', 'in')
  url.searchParams.set('extra_snippets', 'true')

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY!,
    },
  })

  if (!res.ok) {
    throw new Error(`Brave Search error: ${res.status}`)
  }

  const data: BraveSearchResponse = await res.json()
  return data.web?.results ?? []
}

export function extractPricesFromResults(results: BraveWebResult[]): number[] {
  const prices: number[] = []

  for (const result of results) {
    const snippets = result.extra_snippets ?? []
    const text = [result.description, ...snippets].join(' ')

    // Create fresh RegExp per result to avoid stale lastIndex (RESEARCH.md Pitfall 4)
    const pattern = new RegExp(PRICE_REGEX, 'gi')
    let m: RegExpExecArray | null

    while ((m = pattern.exec(text)) !== null) {
      const value = parseFloat(m[1].replace(/,/g, ''))
      if (value > 0) {
        prices.push(value)
      }
    }
  }

  return prices
}

export function computeAveragePrice(prices: number[]): number | null {
  if (prices.length === 0) return null
  const sorted = [...prices].sort((a, b) => a - b)
  const trim = Math.floor(sorted.length * 0.2)
  const upper = sorted.length - trim
  if (upper <= trim) return sorted[Math.floor(sorted.length / 2)]
  const sliced = sorted.slice(trim, upper)
  if (sliced.length === 0) return null
  return sliced.reduce((sum, p) => sum + p, 0) / sliced.length
}
