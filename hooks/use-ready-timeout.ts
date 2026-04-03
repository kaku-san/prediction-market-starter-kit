"use client"

import { useEffect, useState } from "react"

export function useReadyTimeout(ready: boolean, timeoutMs: number = 8000) {
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (ready || timedOut) return

    const timer = window.setTimeout(() => {
      setTimedOut(true)
    }, timeoutMs)

    return () => {
      window.clearTimeout(timer)
    }
  }, [ready, timedOut, timeoutMs])

  return timedOut
}
