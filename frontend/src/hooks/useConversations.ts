// hooks/useConversations.ts
// Data layer for private DMs (server/src/routes/community.ts). REST + polling:
// the inbox list and the unread badge poll every ~10s, an open thread polls for
// new messages every ~5s. There is no websocket — messages appear within one
// poll interval, matching how the app already reads comments.
import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import type { ChatMessage, CommunityProfile, ConversationSummary } from "@/types/community"

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

// Open (or reuse) a 1:1 conversation with another registered user.
export async function openConversation(otherUserId: string): Promise<ConversationSummary> {
  const data = await json<{ conversation: ConversationSummary }>("/community/conversations", {
    method: "POST",
    body: JSON.stringify({ otherUserId }),
  })
  return data.conversation
}

// Unread total for the nav badge. Polled while mounted (the Navbar and the
// stats top bar each mount one while the app is open).
export function useConversationUnread(pollMs = 10000): number {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) {
      setUnread(0)
      return
    }
    let cancelled = false
    const tick = async () => {
      try {
        const data = await json<{ total: number }>("/community/unread-count")
        if (!cancelled) setUnread(data.total)
      } catch {
        /* transient — keep last known value */
      }
    }
    tick()
    const t = setInterval(tick, pollMs)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [user, pollMs])

  return unread
}

// The inbox: every conversation the user is in, most recently active first.
export function useConversationList() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await json<{ conversations: ConversationSummary[] }>("/community/conversations")
      setConversations(data.conversations)
    } catch {
      /* handled by empty/loading state */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    refresh()
    const t = setInterval(refresh, 10000)
    return () => clearInterval(t)
  }, [user, refresh])

  return { conversations, loading, refresh }
}

// An open thread. Fetches the full history on open (and marks it read), then
// polls for messages newer than the newest one we have every 5s.
export function useChatThread(conversationId: string | null) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [withUser, setWithUser] = useState<CommunityProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const lastSeen = useRef<string | null>(null)
  const idRef = useRef<string | null>(null)
  idRef.current = conversationId
  const userRef = useRef(user)
  userRef.current = user

  const markRead = useCallback(async (id: string) => {
    try {
      await json(`/community/conversations/${id}/read`, { method: "POST" })
    } catch {
      /* best-effort */
    }
  }, [])

  // Merge incoming rows into the timeline (deduped by id, sorted ascending).
  const merge = useCallback((incoming: ChatMessage[]) => {
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

  const send = useCallback(
    async (body: string): Promise<boolean> => {
      const id = idRef.current
      if (!id || !body.trim()) return false
      try {
        const data = await json<{ message: ChatMessage }>(
          `/community/conversations/${id}/messages`,
          { method: "POST", body: JSON.stringify({ body }) }
        )
        merge([data.message])
        return true
      } catch {
        return false
      }
    },
    [merge]
  )

  useEffect(() => {
    if (!conversationId || !userRef.current) return
    let cancelled = false
    lastSeen.current = null
    setMessages([])
    setLoading(true)

    const load = async () => {
      const id = idRef.current
      if (!id) return
      try {
        const data = await json<{ messages: ChatMessage[]; withUser: CommunityProfile | null }>(
          `/community/conversations/${id}/messages`
        )
        if (cancelled) return
        setWithUser(data.withUser)
        setMessages(data.messages)
        const last = data.messages[data.messages.length - 1]
        if (last) lastSeen.current = last.createdAt
        void markRead(id)
      } catch {
        /* keep empty */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()

    const t = setInterval(async () => {
      const id = idRef.current
      if (cancelled || !id) return
      const after = lastSeen.current
      const query = after ? `?after=${encodeURIComponent(after)}` : ""
      try {
        const data = await json<{ messages: ChatMessage[] }>(
          `/community/conversations/${id}/messages${query}`
        )
        if (data.messages.length) {
          merge(data.messages)
          void markRead(id)
        }
      } catch {
        /* transient — next tick */
      }
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [conversationId, merge, markRead])

  return { messages, withUser, loading, send }
}
