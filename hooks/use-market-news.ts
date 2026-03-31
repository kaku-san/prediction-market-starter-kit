import { useState, useCallback } from "react"

export interface NewsSource {
  name: string
  url: string
  snippet: string
}

export interface NewsEvent {
  date: string
  title: string
  description: string
  sourceIndices: number[]
  outcome: string | null
}

export interface MarketNews {
  answer: string
  sources: NewsSource[]
  events: NewsEvent[]
}

export function useMarketNews() {
  const [news, setNews] = useState<MarketNews | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNews = useCallback(
    async (params: {
      questionTitle: string
      description?: string
      priceMove: string
      priceSummary?: string
      fromDate: string
      toDate: string
    }) => {
      setLoading(true)
      setError(null)
      setNews(null)

      try {
        const res = await fetch("/api/market-news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Request failed: ${res.status}`)
        }

        const data: MarketNews = await res.json()
        setNews(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch news")
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { news, loading, error, fetchNews }
}
