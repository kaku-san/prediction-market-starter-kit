"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import * as echarts from "echarts/core"
import { LineChart } from "echarts/charts"
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkPointComponent,
  MarkLineComponent,
} from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkPointComponent,
  MarkLineComponent,
  CanvasRenderer,
])

interface MarketLine {
  label: string
  data: { t: number; p: number }[]
}

export interface ChartEventSource {
  name: string
  url: string
}

export interface ChartEvent {
  t: number
  title: string
  description: string
  sources: ChartEventSource[]
  outcome: string | null
}

const COLORS = [
  "hsl(173, 58%, 39%)",
  "hsl(43, 74%, 49%)",
  "hsl(215, 55%, 52%)",
  "hsl(0, 55%, 55%)",
  "hsl(160, 45%, 45%)",
  "hsl(28, 65%, 50%)",
  "hsl(250, 40%, 55%)",
]

const COLOR_POSITIVE = "hsl(160, 60%, 40%)"
const COLOR_NEGATIVE = "hsl(0, 60%, 55%)"
const COLOR_NEUTRAL = "hsl(250, 50%, 55%)"

function getMarkerColor(
  marker: { direction: string; targetLabel: string },
  labels: string[],
  marketsLen: number
): string {
  const lineIdx = labels.indexOf(marker.targetLabel)
  if (lineIdx >= 0 && marketsLen > 1) return COLORS[lineIdx % COLORS.length]
  if (marker.direction === "up") return COLOR_POSITIVE
  if (marker.direction === "down") return COLOR_NEGATIVE
  return COLOR_NEUTRAL
}

export function MarketChart({ markets, events = [] }: { markets: MarketLine[]; events?: ChartEvent[] }) {
  const [activeEvent, setActiveEvent] = useState<number | null>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  const toggleEvent = useCallback((idx: number) => {
    setActiveEvent((prev) => (prev === idx ? null : idx))
  }, [])

  if (markets.length === 0) return null

  // Merge all timestamps for event marker price reaction computation
  const allTimestamps = new Set<number>()
  for (const m of markets) {
    for (const pt of m.data) {
      allTimestamps.add(pt.t)
    }
  }

  const sorted = Array.from(allTimestamps).sort((a, b) => a - b)

  const marketMaps = markets.map((m) => {
    const map = new Map<number, number>()
    for (const pt of m.data) {
      map.set(pt.t, Math.round(pt.p * 1000) / 10)
    }
    return { label: m.label, map }
  })

  const chartData = sorted.map((t) => {
    const row: Record<string, number> = { t }
    for (const { label, map } of marketMaps) {
      const val = map.get(t)
      if (val !== undefined) row[label] = val
    }
    return row
  })

  const labels = markets.map((m) => m.label)
  for (let i = 1; i < chartData.length; i++) {
    for (const label of labels) {
      if (chartData[i][label] === undefined && chartData[i - 1][label] !== undefined) {
        chartData[i][label] = chartData[i - 1][label]
      }
    }
  }

  // Pre-compute event markers with price reaction stats
  const firstLabel = markets[0]?.label
  const THREE_DAYS = 3 * 24 * 60 * 60

  const eventMarkers = events.map((event) => {
    if (!firstLabel || chartData.length === 0) return null

    // Find closest data point
    let closestIdx = 0
    let closestDist = Math.abs(chartData[0].t - event.t)
    for (let i = 1; i < chartData.length; i++) {
      const dist = Math.abs(chartData[i].t - event.t)
      if (dist < closestDist) {
        closestIdx = i
        closestDist = dist
      }
    }

    const closest = chartData[closestIdx]

    // Match to correct line
    let targetLabel = firstLabel
    if (markets.length > 1 && event.outcome) {
      const outcomeLower = event.outcome.toLowerCase()
      const matched = labels.find((l) => {
        const labelLower = l.toLowerCase()
        return labelLower.includes(outcomeLower) || outcomeLower.includes(labelLower)
      })
      if (matched) {
        targetLabel = matched
      } else {
        return null
      }
    }

    let yVal = closest[targetLabel] as number | undefined
    if (yVal === undefined) {
      for (let offset = 1; offset < chartData.length; offset++) {
        const before = chartData[closestIdx - offset]
        const after = chartData[closestIdx + offset]
        if (before?.[targetLabel] !== undefined) { yVal = before[targetLabel] as number; break }
        if (after?.[targetLabel] !== undefined) { yVal = after[targetLabel] as number; break }
      }
    }
    if (yVal === undefined) return null

    // Price reaction in ±3 day window
    const windowStart = event.t - THREE_DAYS
    const windowEnd = event.t + THREE_DAYS
    const windowPoints = chartData.filter(
      (row) => row.t >= windowStart && row.t <= windowEnd && row[firstLabel] !== undefined
    )

    let direction: "up" | "down" | "neutral" = "neutral"
    let priceChange: number | null = null
    let reactionTime: string | null = null
    let earlyMover: string | null = null

    if (windowPoints.length >= 2) {
      let minPt = windowPoints[0], maxPt = windowPoints[0]
      for (const pt of windowPoints) {
        if ((pt[firstLabel] as number) < (minPt[firstLabel] as number)) minPt = pt
        if ((pt[firstLabel] as number) > (maxPt[firstLabel] as number)) maxPt = pt
      }

      const minVal = minPt[firstLabel] as number
      const maxVal = maxPt[firstLabel] as number
      const swing = maxVal - minVal

      if (swing >= 2) {
        const isUpswing = minPt.t < maxPt.t
        direction = isUpswing ? "up" : "down"
        priceChange = isUpswing ? swing : -swing

        const timeDiffSec = Math.abs(maxPt.t - minPt.t)
        if (timeDiffSec < 3600) {
          reactionTime = `${Math.max(1, Math.round(timeDiffSec / 60))}min`
        } else if (timeDiffSec < 86400) {
          reactionTime = `${Math.round(timeDiffSec / 3600)}hrs`
        } else {
          reactionTime = `${Math.round(timeDiffSec / 86400)}d`
        }

        const moveStartTs = isUpswing ? minPt.t : maxPt.t
        const leadTimeSec = event.t - moveStartTs
        if (leadTimeSec > 3600) {
          if (leadTimeSec < 86400) {
            earlyMover = `${Math.round(leadTimeSec / 3600)}hrs before news`
          } else {
            earlyMover = `${Math.round(leadTimeSec / 86400)}d before news`
          }
        }
      }
    }

    if (direction === "neutral") {
      let priceBefore: number | undefined
      let priceAfter: number | undefined
      for (let i = closestIdx - 1; i >= 0; i--) {
        if (chartData[i][firstLabel] !== undefined) {
          priceBefore = chartData[i][firstLabel] as number
          break
        }
      }
      for (let i = closestIdx + 1; i < chartData.length; i++) {
        if (chartData[i][firstLabel] !== undefined) {
          priceAfter = chartData[i][firstLabel] as number
          break
        }
      }
      if (priceBefore !== undefined && priceAfter !== undefined) {
        const diff = priceAfter - priceBefore
        if (diff > 1) direction = "up"
        else if (diff < -1) direction = "down"
      }
    }

    return {
      x: closest.t, y: yVal, title: event.title, description: event.description,
      t: event.t, direction, sources: event.sources,
      priceChange, reactionTime, earlyMover,
      outcome: event.outcome, targetLabel,
    }
  }).filter((m): m is NonNullable<typeof m> => m !== null)
  .sort((a, b) => a.t - b.t)

  // ── ECharts rendering ──────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const container = chartContainerRef.current
    if (!container) return

    // Compute height from aspect ratio
    const width = container.clientWidth
    container.style.height = `${Math.round(width / 3)}px`

    // Init or reuse chart instance
    let chart = chartInstanceRef.current
    if (!chart || chart.isDisposed()) {
      chart = echarts.init(container)
      chartInstanceRef.current = chart
    }

    // Build series
    const series: echarts.EChartsCoreOption["series"] = markets.map((m, i) => {
      const color = COLORS[i % COLORS.length]
      const seriesData = [...m.data]
        .sort((a, b) => a.t - b.t)
        .map((pt) => [pt.t * 1000, Math.round(pt.p * 1000) / 10])

      // Markers for this line
      const lineMarkers = eventMarkers
        .map((mk, globalIdx) => ({ mk, globalIdx }))
        .filter(({ mk }) => mk.targetLabel === m.label)

      const markPointData = lineMarkers.map(({ mk, globalIdx }) => {
        const mkColor = getMarkerColor(mk, labels, markets.length)
        return {
          name: `event-${globalIdx}`,
          coord: [mk.x * 1000, mk.y],
          symbol: "circle",
          symbolSize: activeEvent === globalIdx ? 22 : 18,
          itemStyle: {
            color: "#fff",
            borderColor: mkColor,
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: `${globalIdx + 1}`,
            color: mkColor,
            fontSize: 10,
            fontWeight: 600 as const,
          },
        }
      })

      // Active marker vertical dashed line
      const activeMarkerLine = lineMarkers.find(({ globalIdx }) => globalIdx === activeEvent)
      const markLineConfig = activeMarkerLine
        ? {
            silent: true,
            symbol: ["none", "none"],
            lineStyle: {
              type: "dashed" as const,
              color: getMarkerColor(activeMarkerLine.mk, labels, markets.length),
              width: 1,
              opacity: 0.5,
            },
            data: [
              [
                { coord: [activeMarkerLine.mk.x * 1000, activeMarkerLine.mk.y] },
                { coord: [activeMarkerLine.mk.x * 1000, 0] },
              ],
            ],
          }
        : undefined

      return {
        name: m.label,
        type: "line" as const,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2 },
        itemStyle: { color },
        data: seriesData,
        connectNulls: true,
        markPoint: markPointData.length > 0 ? { data: markPointData } : undefined,
        markLine: markLineConfig,
      }
    })

    const option: echarts.EChartsCoreOption = {
      grid: { left: 45, right: 16, top: 36, bottom: 24, containLabel: false },
      xAxis: {
        type: "time",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          formatter: (val: number) =>
            new Date(val).toLocaleDateString("en-US", { month: "short" }),
          hideOverlap: true,
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { formatter: "{value}%" },
        splitLine: { lineStyle: { type: "dashed", opacity: 0.3 } },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255,255,255,0.95)",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        textStyle: { color: "#374151", fontSize: 12 },
        formatter: (params: unknown) => {
          const items = params as { seriesName: string; color: string; value: [number, number] }[]
          if (!items?.length) return ""
          const date = new Date(items[0].value[0]).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
          let html = `<div style="font-weight:500;margin-bottom:4px">${date}</div>`
          for (const item of items) {
            html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
              <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${item.color}"></span>
              <span style="color:#6b7280">${item.seriesName}</span>
              <span style="margin-left:auto;font-variant-numeric:tabular-nums">${item.value[1]}%</span>
            </div>`
          }
          return html
        },
      },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 12,
        itemHeight: 8,
        textStyle: { fontSize: 12 },
        data: labels,
      },
      series,
    }

    chart.setOption(option, true)

    // Click handler for markers
    chart.off("click")
    chart.on("click", (params: { componentType?: string; name?: string }) => {
      if (params.componentType === "markPoint" && params.name) {
        const idx = parseInt(params.name.replace("event-", ""), 10)
        if (!isNaN(idx)) toggleEvent(idx)
      }
    })

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      const { width: w } = entries[0].contentRect
      if (w > 0) {
        container.style.height = `${Math.round(w / 3)}px`
        chart?.resize()
      }
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
    }
  }, [markets, eventMarkers, activeEvent, labels, toggleEvent])

  // Cleanup on unmount
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    return () => {
      chartInstanceRef.current?.dispose()
      chartInstanceRef.current = null
    }
  }, [])

  return (
    <div>
      {/* ECharts canvas container */}
      <div ref={chartContainerRef} className="w-full" style={{ aspectRatio: "3/1" }} />

      {/* Event popover card */}
      {activeEvent !== null && eventMarkers[activeEvent] && (() => {
        const marker = eventMarkers[activeEvent]
        const color = getMarkerColor(marker, labels, markets.length)
        const hasPrev = activeEvent > 0
        const hasNext = activeEvent < eventMarkers.length - 1
        return (
          <div className="mt-2 rounded-lg border bg-card shadow-md max-w-sm animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="h-0.5 rounded-t-lg" style={{ backgroundColor: color }} />
            <div className="px-3 py-2.5">
              {/* Header row: badge + date + direction + close */}
              <div className="flex items-center gap-2">
                <span
                  className="shrink-0 size-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {activeEvent + 1}
                </span>
                <span className="text-[11px] font-medium" style={{ color }}>
                  {new Date(marker.t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {marker.outcome && markets.length > 1 && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: color + "20", color }}>
                    {marker.outcome}
                  </span>
                )}
                {marker.direction !== "neutral" && markets.length <= 1 && (
                  <span className="text-[10px]" style={{ color }}>
                    {marker.direction === "up" ? "\u2191" : "\u2193"}
                  </span>
                )}
                <button
                  onClick={() => setActiveEvent(null)}
                  className="ml-auto shrink-0 size-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>

              {/* Title */}
              <p className="text-sm font-semibold mt-1 leading-snug">{marker.title}</p>

              {/* Description — truncated to 2 lines */}
              {marker.description && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{marker.description}</p>
              )}

              {/* Price reaction stats */}
              {marker.priceChange !== null && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: marker.direction === "up" ? "hsl(160, 60%, 95%)" : marker.direction === "down" ? "hsl(0, 60%, 95%)" : "hsl(250, 40%, 95%)",
                      color: marker.direction === "up" ? COLOR_POSITIVE : marker.direction === "down" ? COLOR_NEGATIVE : COLOR_NEUTRAL,
                    }}
                  >
                    {marker.direction === "up" ? "\u2191" : "\u2193"} {marker.priceChange > 0 ? "+" : ""}{Math.round(marker.priceChange)}pts
                    {marker.reactionTime && ` in ${marker.reactionTime}`}
                  </span>
                  {marker.earlyMover && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      Priced in {marker.earlyMover}
                    </span>
                  )}
                </div>
              )}

              {/* Sources + nav row */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                  {marker.sources.map((source, i) => (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title={source.name}
                    >
                      <span className="font-semibold" style={{ color }}>[{i + 1}]</span>
                      <span className="truncate max-w-[60px]">{source.name}</span>
                    </a>
                  ))}
                </div>
                {eventMarkers.length > 1 && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <button
                      onClick={() => hasPrev && setActiveEvent(activeEvent - 1)}
                      disabled={!hasPrev}
                      className="hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    >&larr;</button>
                    <span>{activeEvent + 1}/{eventMarkers.length}</span>
                    <button
                      onClick={() => hasNext && setActiveEvent(activeEvent + 1)}
                      disabled={!hasNext}
                      className="hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    >&rarr;</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Event count hint when markers visible but none selected */}
      {eventMarkers.length > 0 && activeEvent === null && (
        <p className="mt-1.5 text-xs text-muted-foreground/60">
          {eventMarkers.length} events plotted &middot; click a marker to view details
        </p>
      )}
    </div>
  )
}
