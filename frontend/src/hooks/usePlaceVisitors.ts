// hooks/usePlaceVisitors.ts
// "How many registered app users have visited this place" + the most recent
// co-visitors (names/avatars). The server returns only the count to anon/guest
// callers — visitor identities are private — so this hook always fetches and the
// component decides what to render based on the logged-in user.
import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import type { PlaceVisitors } from "@/types/community"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

export function usePlaceVisitors(placeId: string | null) {
  const { user } = useAuth()
  const [data, setData] = useState<PlaceVisitors>({ total: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!placeId) return
    let cancelled = false
    setLoading(true)
    fetch(`${API_BASE}/community/places/${encodeURIComponent(placeId)}`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load visitors: ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setData(json as PlaceVisitors)
      })
      .catch(() => {
        /* offline — the panel stays quiet */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [placeId, user])

  return { total: data.total, visitors: data.visitors ?? [], loading }
}
