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
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    ;(async () => {
      // Show the locally cached list immediately (offline-first), then reconcile
      // against the server. If the initial GET fails (transient mobile network,
      // deploy mid-restart) DON'T leave the persisted list frozen at the stale
      // cache forever — retry once shortly after so a just-unlocked leaf that
      // wasn't in the cache can still appear. Repeated failures are logged for
      // the console rather than swallowed.
      const cached = await getCachedUnlocked().catch(() => null)
      if (!cancelled && cached) setUnlocked(cached)
      try {
        await refetch()
      } catch (err) {
        console.warn("Unlocked-places fetch failed, will retry once:", err)
        retryTimer = setTimeout(() => {
          refetch().catch((retryErr) =>
            console.error("Unlocked-places retry also failed:", retryErr)
          )
        }, 2500)
      }
    })()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [refetch])

  return { unlocked, refetch }
}
