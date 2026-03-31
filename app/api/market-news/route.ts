import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const apiKey = process.env.LINKUP_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Linkup API key not configured" },
      { status: 500 }
    )
  }

  try {
    const { questionTitle, description, priceMove, priceSummary, fromDate, toDate } =
      await request.json()

    if (!questionTitle || !priceMove || !fromDate || !toDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const prompt = `You are analyzing the complete history of a prediction market. Your job is to identify the key real-world events that caused the biggest price movements.

Market question: ${questionTitle}
${description ? `Resolution criteria: ${description}` : ""}
Market overview: ${priceMove}
Time period: ${fromDate} to ${toDate}
${priceSummary ? `\nPrice history data:\n${priceSummary}` : ""}

Using the price history above, identify 8-12 significant real-world events that explain the price movements in this market. Pay special attention to the peaks, troughs, and key reversals listed — these are the most important moments to explain.

Instructions:
- PRIORITIZE explaining the peaks (local highs) and troughs (local lows) in the price data — what caused the price to spike up or crash down at those specific dates?
- Also cover the biggest swings (rapid price changes between dates).
- IMPORTANT: Spread events across the ENTIRE timeline. Do not cluster all events in one period — every month or major phase of the chart should have at least one event if the price moved during that period.
- For each event, explain what happened and how it shifted the probability toward Yes or No.
- Only cite real events with credible sources — do not fabricate or stretch weak evidence.
- List events in chronological order (oldest first).
- If a peak or trough cannot be explained, note it as unexplained rather than omitting it.
- Prefer primary sources and credible reporting.

IMPORTANT: Start each event with its date on its own line in exactly this format:
[YYYY-MM-DD] Short title of the event
Then follow with 1-2 sentences explaining the impact on the market.
If this is a multi-outcome market, also include which specific outcome/option is most affected by adding {{outcome name}} at the end of the title line. Use ONLY the exact outcome names listed in the market description — do not use names of options that are not listed. For example: [2026-01-15] Candidate announces campaign {{JD Vance}}

Return your answer in this format:
- A 2-4 sentence overview of the market's price history and what drove it.
- 8-12 key events (chronological order), each starting with [YYYY-MM-DD] Title on its own line, followed by a 1-2 sentence explanation.

If you cannot find any credible events, say: "No clear events found — price movements may reflect positioning, low-liquidity noise, or information not available in public sources." Do not fabricate events.`

    const res = await fetch("https://api.linkup.so/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: prompt,
        depth: "standard",
        outputType: "sourcedAnswer",
        includeInlineCitations: true,
        fromDate,
        toDate,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `Linkup API error: ${res.status}`, details: text },
        { status: 502 }
      )
    }

    const data = await res.json()

    // Extract dated events from the answer for chart markers
    const events: { date: string; title: string; description: string; sourceIndices: number[]; outcome: string | null }[] = []
    if (data.answer) {
      // Split answer into lines for processing
      const lines = data.answer.split("\n")
      const dateLineRegex = /(?:\[|\*{0,2})(\d{4}-\d{2}-\d{2})(?:\s*(?:to|–|—)\s*(?:\d{4}-)?\d{2}-\d{2})?(?:\]|\*{0,2})\s*[–—\-:]*\s*(.+)/

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(dateLineRegex)
        if (!match) continue

        // Extract outcome tag like {{JD Vance}} if present
        const outcomeMatch = match[2].match(/\{\{(.+?)\}\}/)
        const outcome = outcomeMatch ? outcomeMatch[1].trim() : null

        // Clean up the title: remove markdown, leftover date fragments, citations, outcome tags
        let title = match[2]
          .replace(/\{\{.+?\}\}/g, "")
          .replace(/\*+/g, "")
          .replace(/^\s*[–—\-:]+\s*/, "")
          .replace(/\[\d+\]/g, "")
          .replace(/^(?:to\s+)?(?:\d{4}-)?\d{2}-\d{2}\]\s*/i, "")
          .trim()
        if (!title) continue

        // Collect the description: subsequent non-date, non-empty lines
        const descLines: string[] = []
        for (let j = i + 1; j < lines.length; j++) {
          const line = lines[j].trim()
          if (!line) break
          if (dateLineRegex.test(line)) break
          descLines.push(line)
        }
        const description = descLines
          .join(" ")
          .replace(/\*+/g, "")
          .replace(/\[\d+\]/g, "")
          .trim()

        // Extract citation numbers from the title line + description lines
        const contextBlock = [lines[i], ...descLines].join(" ")
        const citationRegex = /\[(\d+)\]/g
        const sourceIndices: number[] = []
        let citMatch
        while ((citMatch = citationRegex.exec(contextBlock)) !== null) {
          const idx = parseInt(citMatch[1], 10)
          if (!sourceIndices.includes(idx)) sourceIndices.push(idx)
        }

        events.push({ date: match[1], title, description, sourceIndices, outcome })
      }
    }

    return NextResponse.json({ ...data, events })
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch market news" },
      { status: 500 }
    )
  }
}
