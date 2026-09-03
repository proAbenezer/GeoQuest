// hooks/useConnections.ts
// Data layer for the connection graph (request → accept), co-traveler discovery
// and username search (server/src/routes/community.ts). Follows the same REST +
// hand-rolled fetch style as useConversations.ts. Every endpoint is requireAuth,
// so nothing runs for guests — callers gate on the logged-in user like the rest
// of the app.
import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import type {
  ConnectionUser,
  FellowTraveler,
  PendingConnection,
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

// Send a connection request to another registered user. When they've already
// asked ME, the server treats this as the accept. Returns the resulting state
// (connected when it flipped to mutual, pending when a fresh request went out),
// or null on failure so the row can revert its optimistic state.
export async function connectUser(
  userId: string
): Promise<{ connected: boolean; pending: boolean } | null> {
  try {
    const data = await json<{ connected: boolean; pending?: boolean }>(
      "/community/connections",
      { method: "POST", body: JSON.stringify({ userId }) }
    )
    return { connected: data.connected, pending: data.pending ?? false }
  } catch {
    return null
  }
}

// Explicitly accept an incoming request (from the bell or the Requests section).
export async function acceptConnection(userId: string): Promise<boolean> {
  try {
    await json(`/community/connections/${userId}/accept`, { method: "POST" })
    return true
  } catch {
    return false
  }
}

// Remove the connection in whatever state it's in — decline of an incoming
// request, cancelling an outgoing one, or disconnecting an accepted friendship.
// The DELETE endpoint is state-agnostic (deletes the matching row(s)).
export async function removeConnection(userId: string): Promise<boolean> {
  try {
    await json<{ connected: false }>(`/community/connections/${userId}`, {
      method: "DELETE",
    })
    return true
  } catch {
    return false
  }
}

// One-way subscribe to another user's public content (Instagram-style follow):
// instant, no approval, and it also makes the followee's public pins/route feed
// visible. Idempotent — returns true once the row exists.
export async function followUser(userId: string): Promise<boolean> {
  try {
    await json(`/community/follows`, { method: "POST", body: JSON.stringify({ userId }) })
    return true
  } catch {
    return false
  }
}

// Stop following. A connection (if any) is unaffected — follow and connection
// are independent axes.
export async function unfollowUser(userId: string): Promise<boolean> {
  try {
    await json(`/community/follows/${userId}`, { method: "DELETE" })
    return true
  } catch {
    return false
  }
}

// Travelers who have unlocked at least one place I have too (stats board). Rows
// carry the full relation triple (connected / incomingPending / outgoingPending).
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

// Everyone I'm connected to (accepted both ways) — the Messages → People tab.
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

  // Optimistic removal after a disconnect — keeps the People tab instant without
  // a refetch (PersonRow calls this through its onChanged callback).
  const removeConnectionLocal = useCallback((userId: string) => {
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

  return { connections, loading, refresh, removeConnection: removeConnectionLocal }
}

// Open connection requests: who wants to connect with me (incoming) and who I've
// asked but who hasn't answered yet (outgoing). Drives the Requests section.
export function useConnectionRequests() {
  const { user } = useAuth()
  const [incoming, setIncoming] = useState<PendingConnection[]>([])
  const [outgoing, setOutgoing] = useState<PendingConnection[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await json<{ incoming: PendingConnection[]; outgoing: PendingConnection[] }>(
        "/community/connections/pending"
      )
      setIncoming(data.incoming)
      setOutgoing(data.outgoing)
    } catch {
      /* handled by empty state */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setIncoming([])
      setOutgoing([])
      setLoading(false)
      return
    }
    void refresh()
  }, [user, refresh])

  return { incoming, outgoing, loading, refresh }
}

// Username / name search for the Messages tab's "find any traveler" box. The
// caller debounces the query; this performs one search per call. Results carry
// the relation triple so the row can render Connect/Accept/Message correctly.
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
