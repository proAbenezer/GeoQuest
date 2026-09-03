// hooks/useGroups.ts
// Data layer for co-traveler groups (server/src/routes/groups.ts, mounted
// /groups). Same REST + polling style as useConversations.ts: the group inbox
// polls ~10s (unread badges), an open group polls new messages ~5s via ?after.
// Membership is creator-driven — only the creator adds/removes; anyone can
// leave; only the creator can delete the whole group.
import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import type {
  CommunityProfile,
  GroupChatThread,
  GroupMessage,
  GroupSummary,
  LinkedGroupPin,
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

// ---- Imperative actions ----

// The optional profile a group is created with: an avatar photo URL and a linked
// place (one of the creator's PUBLIC pins). Mirrors the server POST /groups body.
export type GroupProfileInput = {
  imageUrl?: string | null
  pinId?: string | null
}

// Create a group (Telegram-style direct-add) and return its id on success.
export async function createGroup(
  name: string,
  memberUserIds: string[],
  profile?: GroupProfileInput
): Promise<{ id: string } | null> {
  try {
    const data = await json<{ group: { id: string } }>("/groups", {
      method: "POST",
      body: JSON.stringify({
        name,
        memberUserIds,
        imageUrl: profile?.imageUrl,
        pinId: profile?.pinId,
      }),
    })
    return data.group
  } catch {
    return null
  }
}

// Update a group's profile (name / avatar photo / linked place) as its creator.
// Sends the full current profile; pinId null clears the linked place.
export async function updateGroup(
  groupId: string,
  patch: { name: string; imageUrl: string | null; pinId: string | null }
): Promise<boolean> {
  try {
    await json(`/groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    })
    return true
  } catch {
    return false
  }
}

export async function addGroupMember(groupId: string, userId: string): Promise<boolean> {
  try {
    await json(`/groups/${groupId}/members`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    })
    return true
  } catch {
    return false
  }
}

export async function removeGroupMember(groupId: string, userId: string): Promise<boolean> {
  try {
    await json(`/groups/${groupId}/members/${userId}`, { method: "DELETE" })
    return true
  } catch {
    return false
  }
}

export async function leaveGroup(groupId: string): Promise<boolean> {
  try {
    await json(`/groups/${groupId}/leave`, { method: "POST" })
    return true
  } catch {
    return false
  }
}

export async function deleteGroup(groupId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/groups/${groupId}`, {
      method: "DELETE",
      credentials: "include",
    })
    return res.ok
  } catch {
    return false
  }
}

// ---- Hooks ----

// The group inbox (Messages → Groups tab): every group I'm a member of, most
// recently active first, each with an unread badge.
export function useMyGroups() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await json<{ groups: GroupSummary[] }>("/groups")
      setGroups(data.groups)
    } catch {
      /* handled by empty/loading state */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setGroups([])
      setLoading(false)
      return
    }
    refresh()
    const t = setInterval(refresh, 10000)
    return () => clearInterval(t)
  }, [user, refresh])

  return { groups, loading, refresh }
}

// An open group. Full history + roster + mark-read on open; then a 5s poll
// fetches only messages newer than the newest we have (?after). `send` posts a
// message and merges it in; `refresh` re-fetches everything (used after an
// add/remove so the roster + counts update).
export function useGroupThread(groupId: string | null) {
  const { user } = useAuth()
  const [group, setGroup] = useState<GroupChatThread["group"] | null>(null)
  const [pin, setPin] = useState<LinkedGroupPin | null>(null)
  const [members, setMembers] = useState<CommunityProfile[]>([])
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [forbidden, setForbidden] = useState(false) // I left / was removed
  const lastSeen = useRef<string | null>(null)
  const idRef = useRef<string | null>(null)
  idRef.current = groupId
  const userRef = useRef(user)
  userRef.current = user

  const markRead = useCallback(async (id: string) => {
    try {
      await json(`/groups/${id}/read`, { method: "POST" })
    } catch {
      /* best-effort */
    }
  }, [])

  const merge = useCallback((incoming: GroupMessage[]) => {
    if (!incoming.length) return
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]))
      for (const m of incoming) byId.set(m.id, m)
      const merged = Array.from(byId.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      const last = merged[merged.length - 1]
      if (last) lastSeen.current = last.createdAt
      return merged
    })
  }, [])

  const refresh = useCallback(async () => {
    const id = idRef.current
    if (!id || !userRef.current) return
    try {
      const data = await json<GroupChatThread>(`/groups/${id}/messages`)
      setForbidden(false)
      setGroup(data.group)
      setPin(data.pin)
      setMembers(data.members)
      setMessages(data.messages)
      const last = data.messages[data.messages.length - 1]
      if (last) lastSeen.current = last.createdAt
      void markRead(id)
    } catch {
      // 403 when I'm no longer a member (left or removed).
      setForbidden(true)
    }
  }, [markRead])

  const send = useCallback(
    async (body: string): Promise<boolean> => {
      const id = idRef.current
      if (!id || !body.trim()) return false
      try {
        const data = await json<{ message: GroupMessage }>(`/groups/${id}/messages`, {
          method: "POST",
          body: JSON.stringify({ body }),
        })
        merge([data.message])
        return true
      } catch {
        return false
      }
    },
    [merge]
  )

  useEffect(() => {
    if (!groupId || !userRef.current) return
    let cancelled = false
    lastSeen.current = null
    setMessages([])
    setGroup(null)
    setPin(null)
    setMembers([])
    setForbidden(false)
    setLoading(true)

    const load = async () => {
      const id = idRef.current
      if (!id) return
      try {
        const data = await json<GroupChatThread>(`/groups/${id}/messages`)
        if (cancelled) return
        setGroup(data.group)
        setPin(data.pin)
        setMembers(data.members)
        setMessages(data.messages)
        const last = data.messages[data.messages.length - 1]
        if (last) lastSeen.current = last.createdAt
        void markRead(id)
      } catch {
        if (!cancelled) setForbidden(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()

    const t = setInterval(async () => {
      const id = idRef.current
      if (cancelled || !id || !userRef.current) return
      const after = lastSeen.current
      const query = after ? `?after=${encodeURIComponent(after)}` : ""
      try {
        const data = await json<{ messages: GroupMessage[] }>(`/groups/${id}/messages${query}`)
        if (cancelled) return
        if (data.messages.length) {
          merge(data.messages)
          void markRead(id)
        }
      } catch {
        if (!cancelled) setForbidden(true)
      }
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [groupId, merge, markRead])

  return { group, pin, members, messages, loading, forbidden, refresh, send }
}
