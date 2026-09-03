// context/NotificationsContext.tsx
// Global in-app notifications: one provider mounted above the routes polls
// GET /notifications + /unread-count every ~10s and pops a sonner toast for each
// NEW unread row it hasn't seen yet. Live polls toast every genuinely-new row;
// on the very first fetch of a session (login or reload) we can't tell what's
// "new", so we pop only the single newest unread — enough that reopening the app
// right after a message lands does pop, without replaying a whole stale backlog.
// The bell consumes the same context, so a toast fired here and a row read there
// stay consistent.
//
// Guests are never recipients server-side, so the whole poll is gated on
// useAuth().user and the provider no-ops for anonymous sessions.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { Check, MapPin, MessageCircle, MessageSquare, ThumbsUp, UserPlus, Users } from "lucide-react"
import type { NotificationRow } from "@/types/community"
import { useAuth } from "@/context/AuthContext"
import { acceptConnection } from "@/hooks/useConnections"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"
const POLL_MS = 10000

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

/** Standalone read POST (exported so the toast action can clear its own row). */
async function readNotifications(ids?: string[]) {
  try {
    await json("/notifications/read", {
      method: "POST",
      body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
    })
  } catch {
    /* best-effort — the next poll reconciles */
  }
}

function actorName(n: NotificationRow): string {
  const a = n.actor
  if (!a) return "Someone"
  return `${a.firstName} ${a.lastName}`.trim() || "Someone"
}

type NotificationsContextValue = {
  notifications: NotificationRow[]
  unreadCount: number
  /** Force an immediate refetch (after accepting/declining in the bell). */
  refresh: () => void
  /** Mark rows read. Pass ids to mark a subset; omit to clear everything. */
  markRead: (ids?: string[]) => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  // null = never fetched this session; the first fetch pops only the newest
  // unread row (see applyFeed) and adopts the rest silently.
  const seenIds = useRef<Set<string> | null>(null)

  const markRead = useCallback(async (ids?: string[]) => {
    if (ids && ids.length === 0) return
    setNotifications((prev) => {
      const now = new Date().toISOString()
      const idSet = ids ? new Set(ids) : null
      return prev.map((n) =>
        (idSet ? idSet.has(n.id) : true) && !n.readAt ? { ...n, readAt: now } : n
      )
    })
    if (ids) {
      setUnreadCount((c) => Math.max(0, c - ids.length))
    } else {
      setUnreadCount(0)
    }
    await readNotifications(ids)
  }, [])

  // One toast per newly-seen unread row. Kept stable (only navigate is a dep —
  // navigate's identity is stable, so the poll interval in the effect below
  // never resets). Where the row points somewhere real (a DM thread, a group, a
  // traveler's profile) the toast gets a View/Open action that routes there.
  const pushToast = useCallback(
    (n: NotificationRow) => {
      const name = actorName(n)

      const openTarget = () => {
        if (n.type === "message") {
          if (n.refId) navigate(`/messages/${n.refId}`)
        } else if (n.type === "group_added" || n.type === "group_message") {
          if (n.refId) navigate(`/messages/groups/${n.refId}`)
        } else if (n.type === "follow") {
          if (n.actor) navigate(`/users/${n.actor.userId}`)
        } else if (n.type === "comment") {
          // Comment's target is the pin id (route comments point at the route's
          // start pin) — jump to the map centered on it.
          if (n.refId) navigate(`/?pin=${n.refId}`)
        }
      }

      const icon =
        n.type === "connection_request" ? (
          <UserPlus className="h-5 w-5 text-primary" />
        ) : n.type === "connection_accepted" ? (
          <Check className="h-5 w-5 text-emerald-500" />
        ) : n.type === "comment_vote" ? (
          <ThumbsUp className="h-5 w-5 text-primary" />
        ) : n.type === "comment" ? (
          <MessageSquare className="h-5 w-5 text-primary" />
        ) : n.type === "place_unlock" ? (
          <MapPin className="h-5 w-5 text-primary" />
        ) : n.type === "follow" ? (
          <UserPlus className="h-5 w-5 text-primary" />
        ) : n.type === "group_added" ? (
          <Users className="h-5 w-5 text-primary" />
        ) : n.type === "group_message" ? (
          <MessageCircle className="h-5 w-5 text-primary" />
        ) : (
          <MessageCircle className="h-5 w-5 text-primary" />
        )

      if (n.type === "connection_request" && n.actor) {
        // Quick-accept straight from the popup; the full flow stays in the bell.
        toast(`${name} wants to connect`, {
          icon,
          action: {
            label: "Accept",
            onClick: async () => {
              const ok = await acceptConnection(n.actor!.userId)
              // Accepting resolves the request, so this row is no longer pending.
              await readNotifications([n.id])
              toast.success(ok ? `Connected with ${name}` : "Couldn't accept right now")
            },
          },
          duration: 6000,
        })
        return
      }

      // Title/description per type; everything else follows the icon + target.
      let title: string
      let description: string | undefined
      switch (n.type) {
        case "connection_accepted":
          title = `${name} accepted your connection`
          break
        case "comment_vote":
          title = `${name} voted on your comment`
          description = n.context ?? undefined
          break
        case "comment":
          title = `${name} commented`
          description = n.context ?? undefined
          break
        case "place_unlock":
          title = `${name} unlocked ${n.context ?? "a place"}`
          break
        case "follow":
          title = `${name} followed you`
          break
        case "group_added":
          title = `${name} added you to ${n.context ?? "a group"}`
          break
        case "group_message":
          title = `New group message from ${name}`
          description = n.context ?? undefined
          break
        case "message":
        default:
          title = `New message from ${name}`
          description = n.context ?? undefined
          break
      }

      const actionLabel =
        n.type === "group_added" || n.type === "group_message"
          ? "Open"
          : n.type === "follow" || n.type === "message" || n.type === "comment"
            ? "View"
            : undefined

      const opts: {
        icon: ReactNode
        description?: string
        action?: { label: string; onClick: () => void }
        duration: number
      } = { icon, description, duration: 5000 }
      if (actionLabel) opts.action = { label: actionLabel, onClick: openTarget }
      toast(title, opts)
    },
    [navigate]
  )

  const applyFeed = useCallback(
    (rows: NotificationRow[]) => {
      const firstFetch = seenIds.current === null
      const seen = seenIds.current ?? new Set<string>()
      const toastQueue: NotificationRow[] = []
      for (const n of rows) {
        if (seen.has(n.id)) continue
        seen.add(n.id)
        if (!n.readAt) toastQueue.push(n)
      }
      seenIds.current = seen
      setNotifications(rows)
      // Feed is newest-first, so toastQueue[0] is the freshest unread row. A
      // first fetch after login/reload can't know what the user has truly seen,
      // so pop just that one (never the whole backlog); live polls below replay
      // every genuinely new row instead.
      if (firstFetch) toastQueue.slice(0, 1).forEach(pushToast)
      else toastQueue.forEach(pushToast)
    },
    [pushToast]
  )

  const refresh = useCallback(async () => {
    try {
      const [feed, count] = await Promise.all([
        json<{ notifications: NotificationRow[] }>("/notifications?limit=50"),
        json<{ total: number }>("/notifications/unread-count"),
      ])
      applyFeed(feed.notifications)
      setUnreadCount(count.total)
    } catch {
      /* transient — keep last known values */
    }
  }, [applyFeed])

  useEffect(() => {
    if (!user) {
      seenIds.current = null
      setNotifications([])
      setUnreadCount(0)
      return
    }
    refresh()
    const t = setInterval(refresh, POLL_MS)
    return () => clearInterval(t)
  }, [user, refresh])

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, refresh, markRead }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider")
  return ctx
}
