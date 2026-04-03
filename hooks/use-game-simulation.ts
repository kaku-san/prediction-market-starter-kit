"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface GameEvent {
  id: string
  type: "score" | "foul" | "timeout" | "turnover" | "block" | "steal" | "rebound"
  team: "home" | "away"
  player: string
  points?: number
  description: string
  timestamp: number
}

export interface GameState {
  homeTeam: { name: string; abbrev: string; score: number; color: string }
  awayTeam: { name: string; abbrev: string; score: number; color: string }
  quarter: number
  clock: string
  shotClock: number
  possession: "home" | "away"
  ballPosition: { x: number; y: number }
  events: GameEvent[]
  momentum: number // -100 (away) to 100 (home)
  isLive: boolean
}

const TEAM_COLORS: Record<string, string> = {
  lakers: "#552583", celtics: "#007A33", warriors: "#1D428A", bulls: "#CE1141",
  nets: "#000000", bucks: "#00471B", "76ers": "#006BB6", suns: "#E56020",
  nuggets: "#0E2240", heat: "#98002E", knicks: "#006BB6", clippers: "#C8102E",
  cavaliers: "#860038", mavericks: "#00538C", grizzlies: "#5D76A9",
  timberwolves: "#0C2340", pelicans: "#0C2340", thunder: "#007AC1",
  kings: "#5A2D81", raptors: "#CE1141", pacers: "#002D62", hawks: "#E03A3E",
  hornets: "#1D1160", wizards: "#002B5C", pistons: "#C8102E", magic: "#0077C0",
  spurs: "#C4CED4", blazers: "#E03A3E", rockets: "#CE1141", jazz: "#002B5C",
}

function getTeamColor(name: string): string {
  return TEAM_COLORS[name.toLowerCase()] ?? "#6366f1"
}

const PLAYERS = {
  home: ["J. Johnson", "M. Williams", "D. Carter", "K. Thomas", "A. Brown"],
  away: ["L. Davis", "R. Wilson", "T. Anderson", "C. Martinez", "S. Lee"],
}

const EVENT_TYPES: Array<{ type: GameEvent["type"]; weight: number }> = [
  { type: "score", weight: 40 },
  { type: "foul", weight: 15 },
  { type: "turnover", weight: 12 },
  { type: "steal", weight: 10 },
  { type: "block", weight: 8 },
  { type: "rebound", weight: 10 },
  { type: "timeout", weight: 5 },
]

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of items) {
    r -= item.weight
    if (r <= 0) return item
  }
  return items[items.length - 1]
}

function randomPlayer(team: "home" | "away") {
  const roster = PLAYERS[team]
  return roster[Math.floor(Math.random() * roster.length)]
}

function formatClock(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function describeEvent(event: Omit<GameEvent, "id" | "description" | "timestamp">): string {
  const p = event.player
  switch (event.type) {
    case "score":
      if (event.points === 3) return `${p} drains a three-pointer!`
      if (event.points === 2) return `${p} scores on a mid-range jumper`
      return `${p} hits a free throw`
    case "foul": return `Foul called on ${p}`
    case "turnover": return `${p} loses the ball — turnover`
    case "steal": return `${p} with the steal!`
    case "block": return `${p} blocks the shot!`
    case "rebound": return `${p} grabs the rebound`
    case "timeout": return `Timeout called`
    default: return `Play by ${p}`
  }
}

const COURT_POSITIONS = [
  { x: 25, y: 50 }, { x: 40, y: 25 }, { x: 40, y: 75 },
  { x: 55, y: 30 }, { x: 55, y: 70 }, { x: 70, y: 50 },
  { x: 30, y: 40 }, { x: 30, y: 60 }, { x: 65, y: 35 },
  { x: 65, y: 65 }, { x: 50, y: 50 }, { x: 20, y: 50 },
  { x: 80, y: 50 }, { x: 45, y: 15 }, { x: 45, y: 85 },
]

export function useGameSimulation(
  homeTeamName = "Lakers",
  awayTeamName = "Celtics",
  autoStart = true
): { game: GameState; pause: () => void; resume: () => void } {
  const eventIdRef = useRef(0)

  const [game, setGame] = useState<GameState>({
    homeTeam: { name: homeTeamName, abbrev: homeTeamName.slice(0, 3).toUpperCase(), score: 48, color: getTeamColor(homeTeamName) },
    awayTeam: { name: awayTeamName, abbrev: awayTeamName.slice(0, 3).toUpperCase(), score: 45, color: getTeamColor(awayTeamName) },
    quarter: 3,
    clock: formatClock(420),
    shotClock: 24,
    possession: "home",
    ballPosition: COURT_POSITIONS[0],
    events: [],
    momentum: 10,
    isLive: autoStart,
  })

  const generateEvent = useCallback(() => {
    setGame((prev) => {
      const eventType = pickWeighted(EVENT_TYPES).type
      const team: "home" | "away" = Math.random() > 0.5 ? "home" : "away"
      const player = randomPlayer(team)

      let points: number | undefined
      if (eventType === "score") {
        const roll = Math.random()
        points = roll < 0.3 ? 3 : roll < 0.85 ? 2 : 1
      }

      const partialEvent = { type: eventType, team, player, points }
      const newEvent: GameEvent = {
        ...partialEvent,
        id: `evt-${++eventIdRef.current}`,
        description: describeEvent(partialEvent),
        timestamp: Date.now(),
      }

      let homeScore = prev.homeTeam.score
      let awayScore = prev.awayTeam.score
      if (eventType === "score") {
        if (team === "home") homeScore += points!
        else awayScore += points!
      }

      // Momentum shifts toward scoring team
      let momentum = prev.momentum
      if (eventType === "score") {
        momentum += team === "home" ? 15 : -15
      } else if (eventType === "steal" || eventType === "block") {
        momentum += team === "home" ? 8 : -8
      } else if (eventType === "turnover") {
        momentum += team === "home" ? -5 : 5
      }
      momentum = Math.max(-100, Math.min(100, momentum))
      // Decay toward center
      momentum = Math.round(momentum * 0.95)

      const newBallPos = COURT_POSITIONS[Math.floor(Math.random() * COURT_POSITIONS.length)]
      const newPossession: "home" | "away" =
        eventType === "score" ? (team === "home" ? "away" : "home") :
        eventType === "steal" || eventType === "turnover" ? (team === "home" ? "away" : "home") :
        team

      return {
        ...prev,
        homeTeam: { ...prev.homeTeam, score: homeScore },
        awayTeam: { ...prev.awayTeam, score: awayScore },
        possession: newPossession,
        ballPosition: newBallPos,
        events: [newEvent, ...prev.events].slice(0, 20),
        momentum,
      }
    })
  }, [])

  // Clock tick
  useEffect(() => {
    if (!game.isLive) return
    const interval = setInterval(() => {
      setGame((prev) => {
        const [mins, secs] = prev.clock.split(":").map(Number)
        let total = mins * 60 + secs - 1
        let quarter = prev.quarter
        if (total <= 0) {
          quarter = Math.min(quarter + 1, 4)
          total = 720
        }
        const newShotClock = prev.shotClock <= 1 ? 24 : prev.shotClock - 1
        return {
          ...prev,
          clock: formatClock(total),
          shotClock: newShotClock,
          quarter,
        }
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [game.isLive])

  // Random events
  useEffect(() => {
    if (!game.isLive) return
    const interval = setInterval(() => {
      generateEvent()
    }, 3000 + Math.random() * 4000)
    return () => clearInterval(interval)
  }, [game.isLive, generateEvent])

  const pause = useCallback(() => setGame((p) => ({ ...p, isLive: false })), [])
  const resume = useCallback(() => setGame((p) => ({ ...p, isLive: true })), [])

  return { game, pause, resume }
}
