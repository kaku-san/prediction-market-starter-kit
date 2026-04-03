"use client"

import { LiveSportsWidget } from "./live-sports-widget"

export function LiveSportsSection({ homeTeam, awayTeam }: { homeTeam?: string; awayTeam?: string }) {
  return (
    <div className="mt-6">
      <LiveSportsWidget homeTeam={homeTeam} awayTeam={awayTeam} />
    </div>
  )
}
