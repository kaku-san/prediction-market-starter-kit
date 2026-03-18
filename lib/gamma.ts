const GAMMA_BASE_URL = "https://gamma-api.polymarket.com"

export interface Market {
  id: string
  question: string
  slug: string
  description: string
  active: boolean
  closed: boolean
  archived: boolean
  volume: number
  volume_24hr: number
  liquidity: number
  start_date: string
  end_date: string
  outcome_prices: string
  outcomePrices: string
  outcomes: string
  image: string
  icon: string
  groupItemTitle: string
  volumeNum: number
  clobTokenIds: string
  tokens: {
    token_id: string
    outcome: string
    price: number
    winner: boolean
  }[]
}

export interface Event {
  id: string
  title: string
  slug: string
  description: string
  active: boolean
  closed: boolean
  archived: boolean
  volume: number
  volume_24hr: number
  liquidity: number
  start_date: string
  end_date: string
  image: string
  icon: string
  tag_id: string
  endDate: string
  createdAt: string
  commentCount: number
  competitive: number
  markets: Market[]
  tags: { id: string; label: string; slug: string }[]
  series: { id: string; title: string; slug: string }[]
  has_more?: boolean
}

export interface PricePoint {
  t: number
  p: number
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return ""
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
}

export async function getEvents(params: {
  active?: boolean
  closed?: boolean
  archived?: boolean
  limit?: number
  offset?: number
  order?: string
  ascending?: boolean
  slug?: string
  tag_id?: string
  series_id?: string
} = {}): Promise<Event[]> {
  const query = buildQuery(params)
  const res = await fetch(`${GAMMA_BASE_URL}/events${query}`, {
    next: { revalidate: 60 },
  })

  if (!res.ok) {
    throw new Error(`Gamma API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export async function getPriceHistory(
  tokenId: string,
  interval: "1h" | "6h" | "1d" | "1w" | "1m" | "max" | "all" = "all",
  fidelity: number = 60
): Promise<PricePoint[]> {
  const query = buildQuery({ market: tokenId, interval, fidelity })
  const res = await fetch(`https://clob.polymarket.com/prices-history${query}`, {
    next: { revalidate: 300 },
  })

  if (!res.ok) return []

  const data = await res.json()
  return data.history ?? []
}

export async function searchEvents(query: string, limit = 5): Promise<Event[]> {
  const q = buildQuery({ q: query, limit_per_type: limit, events_status: "active" })
  const res = await fetch(`${GAMMA_BASE_URL}/public-search${q}`, {
    next: { revalidate: 0 },
  })

  if (!res.ok) return []
  const data = await res.json()
  return data.events ?? []
}
