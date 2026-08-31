import { useState, useEffect, useCallback } from "react"
import { fetchUnlockedPlaces } from "@/lib/api"
import { getCachedUnlocked, setCachedUnlocked } from "@/lib/idb"
import type { UnlockedEntry } from "@/types/place"

export function useUnlockedPlaces() {
  const [unlocked, setUnlocked] = useState<UnlockedEntry[]>([])

  const refetch = useCallback(async () => {
    const data = await fetchUnlockedPlaces()
    setUnlocked(data.unlocked)
    await setCachedUnlocked(data.unlocked)
  }, [])

  useEffect(() => {
    ;(async () => {
      const cached = await getCachedUnlocked()
      if (cached) setUnlocked(cached)
      await refetch()
    })()
  }, [refetch])

  return { unlocked, refetch }
}
