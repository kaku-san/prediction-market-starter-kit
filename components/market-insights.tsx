"use client"

import { MarketChart } from "@/components/market-chart"
import { MarketNews } from "@/components/market-news"
import { useMarketNews } from "@/hooks/use-market-news"
import type { Market, PricePoint } from "@/lib/gamma"

interface MarketLine {
  label: string
  data: { t: number; p: number }[]
}

export function MarketInsights({
  chartMarkets,
  primaryMarket,
  primaryPriceHistory,
  createdAt,
  eventTitle,
  marketLabels,
}: {
  chartMarkets: MarketLine[]
  primaryMarket: Market | null
  primaryPriceHistory: PricePoint[]
  createdAt?: string
  eventTitle?: string
  marketLabels?: string[]
}) {
  const newsState = useMarketNews()

  // Convert news events to chart markers with unix timestamps and resolved sources
  const allSources = newsState.news?.sources ?? []
  const chartEvents = (newsState.news?.events ?? [])
    .map((e) => {
      const ts = Math.floor(new Date(e.date + "T12:00:00Z").getTime() / 1000)
      if (isNaN(ts)) return null
      const sources = (e.sourceIndices ?? [])
        .map((idx) => allSources[idx - 1])  // citations are 1-indexed
        .filter((s): s is NonNullable<typeof s> => s != null)
        .slice(0, 3)  // max 3 sources per event
      return { t: ts, title: e.title, description: e.description ?? "", sources, outcome: e.outcome ?? null }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)

  return (
    <>
      {chartMarkets.length > 0 && (
        <div className="mt-6">
          <MarketChart markets={chartMarkets} events={chartEvents} />
        </div>
      )}

      {primaryMarket && primaryPriceHistory.length > 0 && (
        <MarketNews
          market={primaryMarket}
          priceHistory={primaryPriceHistory}
          newsState={newsState}
          createdAt={createdAt}
          eventTitle={eventTitle}
          marketLabels={marketLabels}
        />
      )}
    </>
  )
}
