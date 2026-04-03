"use client"

import { useGameSimulation, type GameEvent } from "@/hooks/use-game-simulation"
import { BasketballCourt } from "./basketball-court"
import { Card } from "@/components/ui/card"

function Scoreboard({
  homeTeam,
  awayTeam,
  quarter,
  clock,
  shotClock,
  possession,
}: {
  homeTeam: { name: string; abbrev: string; score: number; color: string }
  awayTeam: { name: string; abbrev: string; score: number; color: string }
  quarter: number
  clock: string
  shotClock: number
  possession: "home" | "away"
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-4">
      {/* Home team */}
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: homeTeam.color }}>
          {homeTeam.abbrev.slice(0, 3)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold truncate">{homeTeam.name}</span>
            {possession === "home" && <span className="size-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />}
          </div>
          <span className="text-xs text-muted-foreground">Home</span>
        </div>
        <span className="text-3xl font-bold tabular-nums ml-auto">{homeTeam.score}</span>
      </div>

      {/* Clock */}
      <div className="flex flex-col items-center px-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Q{quarter}
        </div>
        <div className="text-2xl font-bold tabular-nums leading-tight">{clock}</div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="tabular-nums">{shotClock}s</span>
        </div>
      </div>

      {/* Away team */}
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold tabular-nums">{awayTeam.score}</span>
        <div className="min-w-0 text-right flex-1">
          <div className="flex items-center gap-1.5 justify-end">
            {possession === "away" && <span className="size-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />}
            <span className="font-semibold truncate">{awayTeam.name}</span>
          </div>
          <span className="text-xs text-muted-foreground">Away</span>
        </div>
        <div className="size-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: awayTeam.color }}>
          {awayTeam.abbrev.slice(0, 3)}
        </div>
      </div>
    </div>
  )
}

function MomentumBar({ momentum, homeColor, awayColor }: { momentum: number; homeColor: string; awayColor: string }) {
  const pct = (momentum + 100) / 2

  return (
    <div className="px-6 py-2">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">
        <span>Momentum</span>
        <span>{momentum > 10 ? "Home" : momentum < -10 ? "Away" : "Neutral"}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/30 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${awayColor}, transparent 30%, transparent 70%, ${homeColor})`,
            opacity: 0.6,
          }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/10" />
        <div
          className="absolute top-1/2 size-2.5 rounded-full border-2 border-background shadow-sm transition-all duration-700 ease-out"
          style={{
            left: `${pct}%`,
            transform: `translate(-50%, -50%)`,
            backgroundColor: momentum > 0 ? homeColor : awayColor,
          }}
        />
      </div>
    </div>
  )
}

function eventIcon(type: GameEvent["type"]) {
  switch (type) {
    case "score": return "🏀"
    case "foul": return "🚩"
    case "timeout": return "⏸"
    case "turnover": return "↩"
    case "block": return "🖐"
    case "steal": return "⚡"
    case "rebound": return "↑"
    default: return "•"
  }
}

function PlayByPlay({ events, homeColor, awayColor }: { events: GameEvent[]; homeColor: string; awayColor: string }) {
  return (
    <div className="px-6 pb-4">
      <div className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-widest">Play-by-Play</div>
      <div className="space-y-0.5 max-h-[140px] overflow-y-auto">
        {events.slice(0, 8).map((event, i) => (
          <div
            key={event.id}
            className="flex items-center gap-2 text-sm py-1 animate-in fade-in slide-in-from-top-1 duration-300"
            style={{ opacity: 1 - i * 0.1 }}
          >
            <span className="text-sm leading-none">{eventIcon(event.type)}</span>
            <div
              className="w-0.5 h-3.5 rounded-full shrink-0"
              style={{ backgroundColor: event.team === "home" ? homeColor : awayColor }}
            />
            <span className={`flex-1 text-sm ${i === 0 ? "font-medium" : "text-muted-foreground"}`}>
              {event.description}
            </span>
            {event.type === "score" && event.points && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 shrink-0">
                +{event.points}
              </span>
            )}
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-sm text-muted-foreground py-2">Waiting for game events...</div>
        )}
      </div>
    </div>
  )
}

export function LiveSportsWidget({
  homeTeam = "Lakers",
  awayTeam = "Celtics",
}: {
  homeTeam?: string
  awayTeam?: string
}) {
  const { game } = useGameSimulation(homeTeam, awayTeam)

  return (
    <Card className="p-0 overflow-hidden gap-0">
      {/* Live indicator */}
      <div className="flex items-center gap-2 px-6 pt-4 pb-1">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-red-500">
          <span className="size-2 rounded-full bg-red-500 animate-pulse" />
          Live
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">NBA Basketball</span>
      </div>

      <Scoreboard
        homeTeam={game.homeTeam}
        awayTeam={game.awayTeam}
        quarter={game.quarter}
        clock={game.clock}
        shotClock={game.shotClock}
        possession={game.possession}
      />

      <MomentumBar
        momentum={game.momentum}
        homeColor={game.homeTeam.color}
        awayColor={game.awayTeam.color}
      />

      <div className="px-6 py-3">
        <BasketballCourt
          ballPosition={game.ballPosition}
          possession={game.possession}
          homeColor={game.homeTeam.color}
          awayColor={game.awayTeam.color}
        />
      </div>

      <PlayByPlay
        events={game.events}
        homeColor={game.homeTeam.color}
        awayColor={game.awayTeam.color}
      />
    </Card>
  )
}
