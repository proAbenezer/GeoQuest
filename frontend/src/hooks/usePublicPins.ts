// hooks/usePublicPins.ts
// Data layer for the public-pins audience feed (server/src/routes/pins.ts
// GET /pins/public). The same feed powers the map's "Friends' pins" overlay
// (no ownerId) and a profile's gallery (?ownerId=<id>). Only content whose
// owner the viewer is connected to or follows is returned; guests get nothing,
// so the hook never fires without a logged-in user.
//
// Overlay rows are read-only, so this hook has no write helpers — comment/vote
// flows go through the existing useComments hook against the pin/route target.
import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import type { PublicPin, PublicPinsFeed } from "@/types/community"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

async function json<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" })
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`)
  return data
}

// One-shot fetch of a single owner's public pins (used by the group place
// picker, which needs the creator's OWN public pins — ?ownerId=me). The polling
// hook above is the right tool for the map overlay; this stays imperative so a
// form can refresh the list each time the picker opens.
export async function fetchPublicPinsFor(ownerId: string): Promise<PublicPin[]> {
  try {
    const data = await json<PublicPinsFeed>(
      `/pins/public?ownerId=${encodeURIComponent(ownerId)}`
    )
    return data.pins
  } catch {
    return []
  }
}

export function usePublicPins(opts?: { ownerId?: string | null; pollMs?: number }) {
  const { user } = useAuth()
  const ownerId = opts?.ownerId ?? null
  const pollMs = opts?.pollMs ?? 30000
  const [pins, setPins] = useState<PublicPin[]>([])
  const [routePairs, setRoutePairs] = useState<{ startPinId: string; endPinId: string }[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ""
      const data = await json<PublicPinsFeed>(`/pins/public${query}`)
      setPins(data.pins)
      setRoutePairs(data.routePairs)
    } catch {
      /* handled by empty state */
    } finally {
      setLoading(false)
    }
  }, [ownerId])

  useEffect(() => {
    if (!user) {
      setPins([])
      setRoutePairs([])
      setLoading(false)
      return
    }
    void refresh()
    const t = setInterval(refresh, pollMs)
    return () => clearInterval(t)
  }, [user, refresh, pollMs])

  return { pins, routePairs, loading, refresh }
}
