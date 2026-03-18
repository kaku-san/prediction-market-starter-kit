"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TradeCard } from "@/components/trade-card"
import type { Market, Event } from "@/lib/gamma"
import { parsePrices, parseYesPrice, formatVolume } from "@/lib/prices"

function formatDate(date: string | null) {
  if (!date) return null
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function Timeline({ createdAt, endDate, closed }: { createdAt: string | null; endDate: string | null; closed: boolean }) {
  const now = new Date()
  const ended = closed || (endDate && new Date(endDate) <= now)

  const steps = [
    { label: "Market Created", date: formatDate(createdAt), done: true },
    { label: "Market Ends", date: formatDate(endDate), done: !!ended },
    { label: "Market Resolution", date: closed ? "Resolved" : null, done: closed },
  ]

  return (
    <div className="flex flex-col">
      {steps.map((step, i) => {
        const isActive = !step.done && i === steps.findIndex((s) => !s.done)
        return (
          <div key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`size-2.5 rounded-full shrink-0 mt-1.5 ${
                step.done
                  ? "bg-violet-500 dark:bg-violet-400"
                  : isActive
                  ? "bg-foreground"
                  : "bg-muted-foreground/25"
              }`} />
              {i < steps.length - 1 && (
                <div className={`w-px flex-1 min-h-5 ${
                  step.done ? "bg-violet-500/40 dark:bg-violet-400/30" : "bg-border"
                }`} />
              )}
            </div>
            <div className={`flex-1 flex items-baseline justify-between ${i < steps.length - 1 ? "pb-3" : ""}`}>
              <span className={`text-sm ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                {step.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {step.date ?? "Pending"}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function EventTrading({ markets, relatedEvents = [], createdAt, endDate, closed, children }: { markets: Market[]; relatedEvents?: Event[]; createdAt?: string; endDate?: string; closed?: boolean; children?: React.ReactNode }) {
  const [selectedMarketId, setSelectedMarketId] = useState(markets[0]?.id)
  const [selectedSide, setSelectedSide] = useState<"yes" | "no">("yes")

  const handleSelect = (marketId: string, side: "yes" | "no") => {
    setSelectedMarketId(marketId)
    setSelectedSide(side)
  }

  return (
    <div className="flex gap-8">
      <div className="flex-1 min-w-0">
        {children}
        {markets.length > 1 && (
          <div className="divide-y">
            {markets.map((market) => {
              const [yesPrice, noPrice] = parsePrices(market)
              const pct = Math.round(yesPrice * 100)
              const yesCents = (yesPrice * 100).toFixed(1)
              const noCents = (noPrice * 100).toFixed(1)
              const vol = market.volumeNum ?? market.volume ?? 0

              return (
                <div
                  key={market.id}
                  className="flex items-center justify-between py-3 cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => handleSelect(market.id, "yes")}
                >
                  <div>
                    <div className="font-medium text-base">
                      {market.groupItemTitle || market.question}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {formatVolume(vol)} Vol.
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <span className="text-2xl font-medium w-20 text-right">
                      {pct < 1 && yesPrice > 0 ? "<1%" : `${pct}%`}
                    </span>

                    <Button
                      size="lg"
                      className="bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-400 dark:hover:bg-teal-950/60 border-0 min-w-[140px] font-medium"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelect(market.id, "yes")
                      }}
                    >
                      Buy Yes {yesCents}¢
                    </Button>
                    <Button
                      size="lg"
                      className="bg-red-50 text-red-700/80 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 border-0 min-w-[140px] font-medium"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelect(market.id, "no")
                      }}
                    >
                      Buy No {noCents}¢
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="w-[380px] shrink-0 ml-5 self-start sticky top-8">
        <TradeCard
          markets={markets}
          selectedMarketId={selectedMarketId}
          selectedSide={selectedSide}
        />

        <div className="mt-6">
          <h3 className="font-semibold text-lg mb-4">Timeline</h3>
          <Timeline
            createdAt={createdAt ?? null}
            endDate={endDate ?? null}
            closed={!!closed}
          />
        </div>

        {relatedEvents.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-lg mb-4">Related Markets</h3>
            <div className="divide-y">
              {relatedEvents.map((event, i) => {
                const market = event.markets?.[0]
                const pct = market ? Math.round(parseYesPrice(market) * 100) : 0

                return (
                  <Link
                    key={event.id}
                    href={`/${event.slug}`}
                    className="flex items-center gap-3 py-3 transition-colors"
                  >
                    <span className="text-sm text-muted-foreground w-5 shrink-0">{i + 1}</span>
                    {event.image && (
                      <img src={event.image} alt="" className="size-8 rounded-md object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-snug line-clamp-2">{event.title}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-semibold">{pct}%</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
