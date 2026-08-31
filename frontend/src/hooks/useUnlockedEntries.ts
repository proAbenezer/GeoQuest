// hooks/useUnlockedEntries.ts
import { useState, useEffect } from "react"
import type { UnlockedEntry } from "@/types/place"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

export function useUnlockedEntries() {
  const [unlockedEntries, setUnlockedEntries] = useState<UnlockedEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUnlockedEntries() {
      try {
        const response = await fetch(`${API_BASE}/api/unlocked`, {
          credentials: "include",
        })
        if (!response.ok) {
          throw new Error("Failed to fetch unlocked entries")
        }
        const data = await response.json()
        setUnlockedEntries(data.unlockedEntries || [])
      } catch (error) {
        console.error("Error fetching unlocked entries:", error)
        setUnlockedEntries([])
      } finally {
        setLoading(false)
      }
    }

    fetchUnlockedEntries()
  }, [])

  return { unlockedEntries, loading }
}
