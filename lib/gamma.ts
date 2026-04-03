const GAMMA_BASE_URL = "https://gamma-api.polymarket.com"
const REQUEST_TIMEOUT_MS = 8000

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

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch (error) {
    if (error instanceof Error && error.name !== "AbortError") {
      console.error(`Request failed for ${url}: ${error.message}`)
    }
    return null
  } finally {
    clearTimeout(timeout)
  }
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
  const data = await fetchJson<Event[]>(`${GAMMA_BASE_URL}/events${query}`, {
    next: { revalidate: 60 },
  })
  return data ?? []
}

export async function getPriceHistory(
  tokenId: string,
  interval: "1h" | "6h" | "1d" | "1w" | "1m" | "max" | "all" = "all",
  fidelity: number = 60
): Promise<PricePoint[]> {
  const query = buildQuery({ market: tokenId, interval, fidelity })
  const data = await fetchJson<{ history?: PricePoint[] }>(`https://clob.polymarket.com/prices-history${query}`, {
    next: { revalidate: 300 },
  })
  return data?.history ?? []
}

export async function searchEvents(query: string, limit = 5): Promise<Event[]> {
  const q = buildQuery({ q: query, limit_per_type: limit, events_status: "active" })
  const data = await fetchJson<{ events?: Event[] }>(`${GAMMA_BASE_URL}/public-search${q}`, {
    next: { revalidate: 0 },
  })
  return data?.events ?? []
}
