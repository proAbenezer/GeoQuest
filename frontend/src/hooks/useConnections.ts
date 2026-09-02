// hooks/useConnections.ts
// Data layer for the co-traveler / connection graph + username search
// (server/src/routes/community.ts). Follows the same REST + hand-rolled fetch
// style as useConversations.ts. Every endpoint is requireAuth, so nothing runs
// for guests — callers gate on the logged-in user like the rest of the app.
import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import type {
  ConnectionUser,
  FellowTraveler,
  UserSearchResult,
} from "@/types/community"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`)
  return data
}

// Follow another registered user. Idempotent server-side; false on network
// failure so a row can revert its optimistic toggle.
export async function followUser(userId: string): Promise<boolean> {
  try {
    await json<{ connected: true }>("/community/connections", {
      method: "POST",
      body: JSON.stringify({ userId }),
    })
    return true
  } catch {
    return false
  }
}

export async function unfollowUser(userId: string): Promise<boolean> {
  try {
    await json<{ connected: false }>(`/community/connections/${userId}`, {
      method: "DELETE",
    })
    return true
  } catch {
    return false
  }
}

// Travelers who have unlocked at least one place I have too (stats board).
export function useCoTravelers() {
  const { user } = useAuth()
  const [travelers, setTravelers] = useState<FellowTraveler[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await json<{ travelers: FellowTraveler[] }>("/community/co-travelers")
      setTravelers(data.travelers)
    } catch {
      /* handled by empty state */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setTravelers([])
      setLoading(false)
      return
    }
    void refresh()
  }, [user, refresh])

  return { travelers, loading, refresh }
}

// Everyone I follow (Messages → People tab).
export function useConnections() {
  const { user } = useAuth()
  const [connections, setConnections] = useState<ConnectionUser[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await json<{ connections: ConnectionUser[] }>("/community/connections")
      setConnections(data.connections)
    } catch {
      /* handled by empty state */
    } finally {
      setLoading(false)
    }
  }, [])

  // Optimistic removal after an unfollow — keeps the People tab instant without
  // a refetch (PersonRow calls this through onUnfollowed).
  const removeConnection = useCallback((userId: string) => {
    setConnections((prev) => prev.filter((c) => c.userId !== userId))
  }, [])

  useEffect(() => {
    if (!user) {
      setConnections([])
      setLoading(false)
      return
    }
    void refresh()
  }, [user, refresh])

  return { connections, loading, refresh, removeConnection }
}

// Username / name search for the Messages tab's "find any traveler" box. The
// caller debounces the query; this performs one search per call.
export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  const query = q.trim()
  if (query.length < 2) return []
  try {
    const data = await json<{ users: UserSearchResult[] }>(
      `/community/users?q=${encodeURIComponent(query)}`
    )
    return data.users
  } catch {
    return []
  }
}
