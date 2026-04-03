const SPORTS_KEYWORDS = [
  "nba", "nfl", "mlb", "nhl", "mls",
  "basketball", "football", "baseball", "hockey", "soccer",
  "championship", "playoffs", "finals", "super bowl", "world series",
  "game", "match", "series", "vs", "versus",
  "lakers", "celtics", "warriors", "bulls", "nets",
  "win", "score", "mvp", "season",
]

const BASKETBALL_KEYWORDS = [
  "nba", "basketball", "lakers", "celtics", "warriors", "bulls", "nets",
  "bucks", "76ers", "suns", "nuggets", "heat", "knicks", "clippers",
  "cavaliers", "mavericks", "grizzlies", "timberwolves", "pelicans",
  "thunder", "kings", "raptors", "pacers", "hawks", "hornets",
  "wizards", "pistons", "magic", "spurs", "blazers", "rockets", "jazz",
]

export function isSportsEvent(title: string, tags?: { label: string }[]): boolean {
  const text = title.toLowerCase()
  const tagText = tags?.map((t) => t.label.toLowerCase()).join(" ") ?? ""
  const combined = `${text} ${tagText}`
  return SPORTS_KEYWORDS.some((kw) => combined.includes(kw))
}

export function isBasketballEvent(title: string, tags?: { label: string }[]): boolean {
  const text = title.toLowerCase()
  const tagText = tags?.map((t) => t.label.toLowerCase()).join(" ") ?? ""
  const combined = `${text} ${tagText}`
  return BASKETBALL_KEYWORDS.some((kw) => combined.includes(kw))
}

/** Extract team names from an event title like "Lakers vs Celtics" */
export function extractTeams(title: string): { home: string; away: string } | null {
  const vsMatch = title.match(/(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\s*[-–—:?]|$)/i)
  if (vsMatch) {
    return {
      home: vsMatch[1].trim().split(" ").pop() ?? vsMatch[1].trim(),
      away: vsMatch[2].trim().split(" ").pop() ?? vsMatch[2].trim(),
    }
  }
  return null
}
