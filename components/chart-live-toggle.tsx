"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { MarketChart } from "@/components/market-chart"
import { LiveSportsSection } from "@/components/live-sports/live-sports-section"
import type { PricePoint } from "@/lib/gamma"

interface ChartLiveToggleProps {
  chartMarkets: { label: string; data: PricePoint[] }[]
  homeTeam?: string
  awayTeam?: string
  isBasketball: boolean
}

export function ChartLiveToggle({ chartMarkets, homeTeam, awayTeam, isBasketball }: ChartLiveToggleProps) {
  if (!isBasketball) {
    return chartMarkets.length > 0 ? (
      <div className="mt-6">
        <MarketChart markets={chartMarkets} />
      </div>
    ) : null
  }

  return (
    <Tabs defaultValue="live" className="mt-6">
      <TabsList>
        <TabsTrigger value="live">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-500 animate-pulse" />
            Live Game
          </span>
        </TabsTrigger>
        <TabsTrigger value="chart">Chart</TabsTrigger>
      </TabsList>
      <TabsContent value="live">
        <LiveSportsSection homeTeam={homeTeam} awayTeam={awayTeam} />
      </TabsContent>
      <TabsContent value="chart">
        {chartMarkets.length > 0 ? (
          <MarketChart markets={chartMarkets} />
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">No chart data available</div>
        )}
      </TabsContent>
    </Tabs>
  )
}
