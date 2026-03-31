"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import type { MarketNews as MarketNewsData, NewsSource } from "@/hooks/use-market-news"
import type { Market, PricePoint } from "@/lib/gamma"

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

function formatShortDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function computeMarketSummary(
  priceHistory: PricePoint[],
  createdAt?: string
): { priceMove: string; priceSummary: string; fromDate: string; toDate: string } | null {
  if (priceHistory.length < 2) return null

  const sorted = [...priceHistory].sort((a, b) => a.t - b.t)
  const now = new Date()
  const toDate = formatDate(now)
  const fromDate = createdAt
    ? formatDate(new Date(createdAt))
    : formatDate(new Date(sorted[0].t * 1000))

  const startPct = Math.round(sorted[0].p * 100)
  const endPct = Math.round(sorted[sorted.length - 1].p * 100)

  const priceMove = `Since market creation, the price moved from ${startPct}% to ${endPct}% Yes. Current price: ${endPct}%.`

  // Sample ~20 evenly-spaced data points for the price summary
  const sampleCount = Math.min(20, sorted.length)
  const step = (sorted.length - 1) / (sampleCount - 1)
  const sampled: string[] = []
  for (let i = 0; i < sampleCount; i++) {
    const pt = sorted[Math.round(i * step)]
    sampled.push(`${formatShortDate(pt.t)}: ${Math.round(pt.p * 100)}%`)
  }

  // Detect local peaks and troughs (reversals) using a smoothed window
  // Downsample to ~50 points first to avoid noise
  const dsCount = Math.min(50, sorted.length)
  const dsStep = (sorted.length - 1) / (dsCount - 1)
  const ds: PricePoint[] = []
  for (let i = 0; i < dsCount; i++) {
    ds.push(sorted[Math.round(i * dsStep)])
  }

  const extremes: { type: "peak" | "trough"; t: number; p: number }[] = []
  for (let i = 1; i < ds.length - 1; i++) {
    const prev = Math.round(ds[i - 1].p * 100)
    const curr = Math.round(ds[i].p * 100)
    const next = Math.round(ds[i + 1].p * 100)
    if (curr > prev && curr > next && curr - Math.min(prev, next) >= 3) {
      extremes.push({ type: "peak", t: ds[i].t, p: ds[i].p })
    } else if (curr < prev && curr < next && Math.max(prev, next) - curr >= 3) {
      extremes.push({ type: "trough", t: ds[i].t, p: ds[i].p })
    }
  }

  // Also include the all-time high and low
  let allHigh = sorted[0], allLow = sorted[0]
  for (const pt of sorted) {
    if (pt.p > allHigh.p) allHigh = pt
    if (pt.p < allLow.p) allLow = pt
  }

  const extremeLines: string[] = []
  if (allHigh.p > sorted[0].p) {
    extremeLines.push(`All-time high: ${Math.round(allHigh.p * 100)}% on ${formatShortDate(allHigh.t)}`)
  }
  if (allLow.p < sorted[0].p) {
    extremeLines.push(`All-time low: ${Math.round(allLow.p * 100)}% on ${formatShortDate(allLow.t)}`)
  }

  const reversalLines = extremes.map((e) =>
    `${e.type === "peak" ? "Peak" : "Trough"} at ${Math.round(e.p * 100)}% on ${formatShortDate(e.t)}`
  )

  // Detect significant swings (>5 point changes between consecutive downsampled points)
  const swings: { text: string; mag: number }[] = []
  for (let i = 1; i < ds.length; i++) {
    const prev = ds[i - 1]
    const curr = ds[i]
    const diff = Math.round(curr.p * 100) - Math.round(prev.p * 100)
    if (Math.abs(diff) >= 5) {
      const dir = diff > 0 ? "+" : ""
      swings.push({
        text: `${formatShortDate(prev.t)} → ${formatShortDate(curr.t)}: ${dir}${diff} points`,
        mag: Math.abs(diff),
      })
    }
  }
  // Sort by magnitude and keep top 8
  swings.sort((a, b) => b.mag - a.mag)
  const topSwings = swings.slice(0, 8)

  let priceSummary = `Price timeline (sampled): ${sampled.join(", ")}`
  if (extremeLines.length > 0) {
    priceSummary += `\n${extremeLines.join(". ")}`
  }
  if (reversalLines.length > 0) {
    priceSummary += `\nKey reversals: ${reversalLines.join("; ")}`
  }
  if (topSwings.length > 0) {
    priceSummary += `\nBiggest price swings (by magnitude): ${topSwings.map((s) => s.text).join("; ")}`
  }

  return { priceMove, priceSummary, fromDate, toDate }
}

function renderAnswer(answer: string, sources: NewsSource[]) {
  // Replace inline citation markers [1], [2] etc. with clickable links
  const parts = answer.split(/(\[\d+\])/)
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match) {
      const idx = parseInt(match[1], 10) - 1
      const source = sources[idx]
      if (source?.url) {
        return (
          <a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-600 dark:text-violet-400 hover:underline text-xs align-super"
          >
            [{match[1]}]
          </a>
        )
      }
      return (
        <span key={i} className="text-muted-foreground text-xs align-super">
          [{match[1]}]
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

interface NewsState {
  news: MarketNewsData | null
  loading: boolean
  error: string | null
  fetchNews: (params: {
    questionTitle: string
    description?: string
    priceMove: string
    priceSummary?: string
    fromDate: string
    toDate: string
  }) => Promise<void>
}

export function MarketNews({
  market,
  priceHistory,
  newsState,
  createdAt,
  eventTitle,
  marketLabels,
}: {
  market: Market
  priceHistory: PricePoint[]
  newsState: NewsState
  createdAt?: string
  eventTitle?: string
  marketLabels?: string[]
}) {
  const { news, loading, error, fetchNews } = newsState
  const [hasRequested, setHasRequested] = useState(false)

  const isMultiOutcome = (marketLabels?.length ?? 0) > 1

  const summary = useMemo(
    () => computeMarketSummary(priceHistory, createdAt),
    [priceHistory, createdAt]
  )

  const handleFetch = () => {
    if (!summary) return
    setHasRequested(true)

    // For multi-outcome markets, use the event title and mention all outcomes
    const title = isMultiOutcome && eventTitle
      ? eventTitle
      : market.question
    const desc = isMultiOutcome && marketLabels
      ? `${market.description ?? ""}\n\nThis is a multi-outcome market. The charted options are: ${marketLabels.join(", ")}. ONLY cover events affecting these specific options — do not reference other options not in this list. Tag each event with the relevant option using {{option name}}.`
      : market.description

    fetchNews({
      questionTitle: title,
      description: desc,
      priceMove: summary.priceMove,
      priceSummary: summary.priceSummary,
      fromDate: summary.fromDate,
      toDate: summary.toDate,
    })
  }

  if (!summary && !hasRequested) return null

  return (
    <Card className="p-4 my-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-md">Key Events</h3>
        {!hasRequested && (
          <Button variant="outline" size="sm" onClick={handleFetch}>
            Show key events
          </Button>
        )}
        {hasRequested && !loading && !error && news && (
          <Button variant="ghost" size="sm" onClick={handleFetch}>
            Refresh
          </Button>
        )}
      </div>

      {!hasRequested && summary && (
        <p className="text-sm text-muted-foreground">{summary.priceMove}</p>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
          <Spinner />
          Analyzing market history...
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 py-2">
          {error}
        </div>
      )}

      {news && (
        <div className="space-y-3">
          <div className="text-sm leading-relaxed whitespace-pre-line">
            {renderAnswer(news.answer, news.sources)}
          </div>

          {news.sources.length > 0 && (
            <details className="group">
              <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                {news.sources.length} sources
              </summary>
              <ul className="mt-2 space-y-1.5">
                {news.sources.map((source, i) => (
                  <li key={i} className="text-xs">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      [{i + 1}] {source.name}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Card>
  )
}
