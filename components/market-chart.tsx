"use client"

import { useState, useCallback } from "react"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ReferenceDot } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"

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

const MAX_POINTS = 150

function EventMarker({
  cx,
  cy,
  index,
  isActive,
  onClick,
  color,
  chartBottom,
}: {
  cx?: number
  cy?: number
  index: number
  isActive: boolean
  onClick: () => void
  color: string
  chartBottom: number
}) {
  if (cx === undefined || cy === undefined) return null
  const r = isActive ? 11 : 9

  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      {/* Vertical dashed line from marker to x-axis — only when active */}
      {isActive && (
        <line
          x1={cx}
          y1={cy + r}
          x2={cx}
          y2={chartBottom}
          stroke={color}
          strokeDasharray="4 4"
          strokeWidth={1}
          opacity={0.5}
        />
      )}
      {/* Outer ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="white"
        stroke={color}
        strokeWidth={2}
      />
      {/* Number label */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={10}
        fontWeight={600}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {index + 1}
      </text>
    </g>
  )
}

export function MarketChart({ markets, events = [] }: { markets: MarketLine[]; events?: ChartEvent[] }) {
  const [activeEvent, setActiveEvent] = useState<number | null>(null)

  const toggleEvent = useCallback((idx: number) => {
    setActiveEvent((prev) => (prev === idx ? null : idx))
  }, [])

  if (markets.length === 0) return null

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

  const downsampledData = chartData.length <= MAX_POINTS
    ? chartData
    : (() => {
        const step = (chartData.length - 1) / (MAX_POINTS - 1)
        const result: typeof chartData = []
        for (let i = 0; i < MAX_POINTS; i++) {
          result.push(chartData[Math.round(i * step)])
        }
        return result
      })()

  const config: ChartConfig = {}
  for (let i = 0; i < markets.length; i++) {
    config[markets[i].label] = {
      label: markets[i].label,
      color: COLORS[i % COLORS.length],
    }
  }

  // Pre-compute event markers with their chart coordinates + price reaction stats
  const firstLabel = markets[0]?.label
  const THREE_DAYS = 3 * 24 * 60 * 60 // seconds

  const eventMarkers = events.map((event) => {
    if (!firstLabel || downsampledData.length === 0) return null

    // Find closest downsampled point for chart placement
    let closestIdx = 0
    let closestDist = Math.abs(downsampledData[0].t - event.t)
    for (let i = 1; i < downsampledData.length; i++) {
      const dist = Math.abs(downsampledData[i].t - event.t)
      if (dist < closestDist) {
        closestIdx = i
        closestDist = dist
      }
    }

    const closest = downsampledData[closestIdx]

    // Find which line to place the marker on
    // For multi-line charts with an outcome tag, match to the correct line
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
        // Outcome doesn't match any charted line — skip this event
        return null
      }
    }

    let yVal = closest[targetLabel] as number | undefined

    // Fallback: search nearby points using the target label
    if (yVal === undefined) {
      for (let offset = 1; offset < downsampledData.length; offset++) {
        const before = downsampledData[closestIdx - offset]
        const after = downsampledData[closestIdx + offset]
        if (before?.[targetLabel] !== undefined) { yVal = before[targetLabel] as number; break }
        if (after?.[targetLabel] !== undefined) { yVal = after[targetLabel] as number; break }
      }
    }
    if (yVal === undefined) return null

    // Compute price reaction using full-resolution chartData (±3 days window)
    const windowStart = event.t - THREE_DAYS
    const windowEnd = event.t + THREE_DAYS
    const windowPoints = chartData.filter(
      (row) => row.t >= windowStart && row.t <= windowEnd && row[firstLabel] !== undefined
    )

    let direction: "up" | "down" | "neutral" = "neutral"
    let priceChange: number | null = null
    let reactionTime: string | null = null
    let earlyMover: string | null = null // "Polymarket moved X before news"

    if (windowPoints.length >= 2) {
      // Find min and max in the window
      let minPt = windowPoints[0], maxPt = windowPoints[0]
      for (const pt of windowPoints) {
        if ((pt[firstLabel] as number) < (minPt[firstLabel] as number)) minPt = pt
        if ((pt[firstLabel] as number) > (maxPt[firstLabel] as number)) maxPt = pt
      }

      const minVal = minPt[firstLabel] as number
      const maxVal = maxPt[firstLabel] as number
      const swing = maxVal - minVal

      if (swing >= 2) {
        // Determine if it was an upswing or downswing based on which came first
        const isUpswing = minPt.t < maxPt.t
        direction = isUpswing ? "up" : "down"
        priceChange = isUpswing ? swing : -swing

        // Compute reaction time
        const timeDiffSec = Math.abs(maxPt.t - minPt.t)
        if (timeDiffSec < 3600) {
          reactionTime = `${Math.max(1, Math.round(timeDiffSec / 60))}min`
        } else if (timeDiffSec < 86400) {
          reactionTime = `${Math.round(timeDiffSec / 3600)}hrs`
        } else {
          const days = Math.round(timeDiffSec / 86400)
          reactionTime = `${days}d`
        }

        // Check if price started moving before the event date
        // The start of the move (min for upswing, max for downswing)
        const moveStartTs = isUpswing ? minPt.t : maxPt.t
        const leadTimeSec = event.t - moveStartTs
        if (leadTimeSec > 3600) {
          // Price started moving before the event date
          if (leadTimeSec < 86400) {
            earlyMover = `${Math.round(leadTimeSec / 3600)}hrs before news`
          } else {
            const days = Math.round(leadTimeSec / 86400)
            earlyMover = `${days}d before news`
          }
        }
      }
    }

    // Fallback direction from neighboring downsampled points
    if (direction === "neutral") {
      let priceBefore: number | undefined
      let priceAfter: number | undefined
      for (let i = closestIdx - 1; i >= 0; i--) {
        if (downsampledData[i][firstLabel] !== undefined) {
          priceBefore = downsampledData[i][firstLabel] as number
          break
        }
      }
      for (let i = closestIdx + 1; i < downsampledData.length; i++) {
        if (downsampledData[i][firstLabel] !== undefined) {
          priceAfter = downsampledData[i][firstLabel] as number
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

  return (
    <div>
      <ChartContainer config={config} className="aspect-[3/1] w-full">
        <LineChart data={downsampledData}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tickFormatter={(t: number) =>
              new Date(t * 1000).toLocaleDateString("en-US", { month: "short" })
            }
            tickLine={false}
            axisLine={false}
            interval="equidistantPreserveStart"
            minTickGap={60}
          />
          <YAxis
            tickFormatter={(v: number) => `${v}%`}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const t = payload?.[0]?.payload?.t
                  if (!t) return ""
                  return new Date(t * 1000).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                }}
                formatter={(value) => `${value}%`}
              />
            }
          />
          <ChartLegend verticalAlign="top" align="left" content={<ChartLegendContent className="justify-start" />} />
          {markets.map((m, i) => (
            <Line
              key={m.label}
              type="monotone"
              dataKey={m.label}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
          {eventMarkers.map((marker, idx) => {
            // For multi-line charts with matched outcome, use the line's color
            const lineIdx = labels.indexOf(marker.targetLabel)
            const lineColor = lineIdx >= 0 && markets.length > 1
              ? COLORS[lineIdx % COLORS.length]
              : null
            const color = lineColor
              ?? (marker.direction === "up" ? COLOR_POSITIVE
                : marker.direction === "down" ? COLOR_NEGATIVE
                : COLOR_NEUTRAL)
            return (
              <ReferenceDot
                key={`event-${idx}`}
                x={marker.x}
                y={marker.y}
                shape={
                  <EventMarker
                    index={idx}
                    isActive={activeEvent === idx}
                    onClick={() => toggleEvent(idx)}
                    color={color}
                    chartBottom={500}
                  />
                }
              />
            )
          })}
        </LineChart>
      </ChartContainer>

      {/* Event popover card */}
      {activeEvent !== null && eventMarkers[activeEvent] && (() => {
        const marker = eventMarkers[activeEvent]
        const lineIdx = labels.indexOf(marker.targetLabel)
        const lineColor = lineIdx >= 0 && markets.length > 1
          ? COLORS[lineIdx % COLORS.length]
          : null
        const color = lineColor
          ?? (marker.direction === "up" ? COLOR_POSITIVE
            : marker.direction === "down" ? COLOR_NEGATIVE
            : COLOR_NEUTRAL)
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
                {marker.direction !== "neutral" && !lineColor && (
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
                      color,
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

      {/* Event legend when markers are visible */}
      {eventMarkers.length > 0 && activeEvent === null && (
        <div className="mt-3 flex flex-wrap gap-2">
          {eventMarkers.map((marker, idx) => {
            const lineIdx = labels.indexOf(marker.targetLabel)
            const lineColor = lineIdx >= 0 && markets.length > 1
              ? COLORS[lineIdx % COLORS.length]
              : null
            const color = lineColor
              ?? (marker.direction === "up" ? COLOR_POSITIVE
                : marker.direction === "down" ? COLOR_NEGATIVE
                : COLOR_NEUTRAL)
            return (
              <button
                key={idx}
                onClick={() => setActiveEvent(idx)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <span
                  className="size-4 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {idx + 1}
                </span>
                <span className="text-muted-foreground truncate max-w-[180px]">{marker.title}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
