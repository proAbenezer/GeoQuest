// hooks/useTravelStats.ts
// Loads the materialized travel-summary dashboard (GET /stats). Data is
// computed incrementally server-side on each check-in; this hook only reads.
import { useState, useEffect, useCallback } from "react"
import { fetchStats } from "@/lib/api"
import type { TravelStats } from "@/types/place"

export function useTravelStats() {
  const [data, setData] = useState<TravelStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchStats())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
