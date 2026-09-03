// components/notifications/NotificationBell.tsx
// The bell + inbox for in-app notifications (see context/NotificationsContext for
// the poller that fills it). Opens over any page header (map navbar, /messages,
// /stats, /profile) and lists the newest notifications: an icon + line per type,
// an unread dot, relative time, and — for connection requests — inline
// Accept/Decline. Message rows are clickable straight into that thread. Opening
// the panel marks everything read (the provider's toast logic still only toasts
// genuinely NEW rows, so clearing the badge never replays old ones).
//
// Rendered only for signed-in users; guests have no recipient feed server-side.
import { useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, Check, Loader2, MapPin, MessageCircle, MessageSquare, ThumbsUp, UserPlus, Users, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/context/AuthContext"
import { useNotifications } from "@/context/NotificationsContext"
import { acceptConnection, removeConnection } from "@/hooks/useConnections"
import { timeAgo } from "@/components/comments/CommentSection"
import type { NotificationRow } from "@/types/community"

const MAX_ROWS = 20

function initialsOf(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?"
}

// The icon + headline for one notification, mirroring the toast copy.
function lineFor(n: NotificationRow): { icon: ReactNode; title: string; sub?: string } {
  const name = n.actor
    ? `${n.actor.firstName} ${n.actor.lastName}`.trim()
    : "Someone"
  const common = "h-4 w-4"
  switch (n.type) {
    case "connection_request":
      return { icon: <UserPlus className={`${common} text-primary`} />, title: `${name} wants to connect` }
    case "connection_accepted":
      return { icon: <Check className={`${common} text-emerald-500`} />, title: `${name} accepted your connection` }
    case "comment_vote":
      return {
        icon: <ThumbsUp className={`${common} text-primary`} />,
        title: `${name} voted on your comment`,
        sub: n.context ?? undefined,
      }
    case "comment":
      return {
        icon: <MessageSquare className={`${common} text-primary`} />,
        title: `${name} commented`,
        sub: n.context ?? undefined,
      }
    case "place_unlock":
      return {
        icon: <MapPin className={`${common} text-primary`} />,
        title: `${name} unlocked ${n.context ?? "a place"}`,
      }
    case "follow":
      return { icon: <UserPlus className={`${common} text-primary`} />, title: `${name} followed you` }
    case "group_added":
      return {
        icon: <Users className={`${common} text-primary`} />,
        title: `${name} added you to ${n.context ?? "a group"}`,
      }
    case "group_message":
      return {
        icon: <MessageCircle className={`${common} text-primary`} />,
        title: `New group message from ${name}`,
        sub: n.context ?? undefined,
      }
    case "message":
    default:
      return {
        icon: <MessageCircle className={`${common} text-primary`} />,
        title: `New message from ${name}`,
        sub: n.context ?? undefined,
      }
  }
}

export function NotificationBell() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { notifications, unreadCount, markRead } = useNotifications()
  const [open, setOpen] = useState(false)
  // Per-row busy flag so Accept/Decline can't double-fire.
  const [actingOn, setActingOn] = useState<string | null>(null)

  if (!user) return null

  const shown = notifications.slice(0, MAX_ROWS)
  const badge = unreadCount > 9 ? "9+" : String(unreadCount)

  const openChanged = (next: boolean) => {
    setOpen(next)
    if (next && unreadCount > 0) void markRead()
  }

  const accept = async (n: NotificationRow) => {
    if (!n.actor || actingOn) return
    setActingOn(n.id)
    const ok = await acceptConnection(n.actor.userId)
    setActingOn(null)
    if (ok) void markRead([n.id])
  }

  const decline = async (n: NotificationRow) => {
    if (!n.actor || actingOn) return
    setActingOn(n.id)
    const ok = await removeConnection(n.actor.userId)
    setActingOn(null)
    if (ok) void markRead([n.id])
  }

  // Rows that carry a real destination route on click: DM/group threads, a
  // follower's profile, and a comment's target pin on the map.
  const openThread = (n: NotificationRow) => {
    if (n.type === "group_added" || n.type === "group_message") {
      if (!n.refId) return
      setOpen(false)
      navigate(`/messages/groups/${n.refId}`)
      return
    }
    if (n.type === "follow") {
      if (!n.actor) return
      setOpen(false)
      navigate(`/users/${n.actor.userId}`)
      return
    }
    if (n.type === "comment") {
      // The comment's target pin id (route comments point at the route's start
      // pin) — open the map centered on it.
      if (!n.refId) return
      setOpen(false)
      navigate(`/?pin=${n.refId}`)
      return
    }
    if (!n.refId) return
    setOpen(false)
    navigate(`/messages/${n.refId}`)
  }

  const isClickable = (n: NotificationRow): boolean => {
    if (n.type === "follow") return Boolean(n.actor)
    if (n.type === "group_added" || n.type === "group_message") return Boolean(n.refId)
    if (n.type === "comment") return Boolean(n.refId)
    return n.type === "message" && Boolean(n.refId)
  }

  return (
    <DropdownMenu open={open} onOpenChange={openChanged}>
      <DropdownMenuTrigger
        nativeButton={false}
        render={
          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-card/40 text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
                {badge}
              </span>
            )}
          </button>
        }
      />
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 max-w-[calc(100vw-1.5rem)] rounded-xl p-0 ring-1 ring-border/40"
      >
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Notifications
          </p>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {unreadCount} new
            </span>
          )}
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
            <Bell className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground/60">
              Requests, follows, group chats, unlocks, votes and messages land here.
            </p>
          </div>
        ) : (
          <ul className="max-h-[26rem] overflow-y-auto py-1">
            {shown.map((n) => {
              const line = lineFor(n)
              const clickable = isClickable(n)
              const acting = actingOn === n.id
              return (
                <li key={n.id}>
                  <div
                    role={clickable ? "button" : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={clickable ? () => openThread(n) : undefined}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              openThread(n)
                            }
                          }
                        : undefined
                    }
                    className={`group flex items-start gap-2.5 px-3 py-2 ${
                      !n.readAt ? "bg-primary/[0.04]" : ""
                    } ${clickable ? "cursor-pointer hover:bg-muted/40" : ""}`}
                  >
                    {/* unread dot / icon column */}
                    <span className="mt-0.5 flex shrink-0 items-center">
                      {!n.readAt ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
                      )}
                    </span>
                    <span className="mt-0.5 shrink-0">{line.icon}</span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-sm ${
                            n.readAt
                              ? "text-muted-foreground"
                              : "font-medium text-foreground"
                          }`}
                        >
                          {line.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground/70">
                          {timeAgo(n.createdAt)}
                        </span>
                      </span>
                      {line.sub && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          “{line.sub}”
                        </span>
                      )}

                      {n.type === "connection_request" && n.actor && (
                        <span className="mt-1.5 flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={acting}
                            onClick={(e) => {
                              e.stopPropagation()
                              void accept(n)
                            }}
                            className="inline-flex h-6 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                          >
                            {acting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={acting}
                            onClick={(e) => {
                              e.stopPropagation()
                              void decline(n)
                            }}
                            className="inline-flex h-6 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-60"
                          >
                            {acting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                            Decline
                          </button>
                        </span>
                      )}
                    </span>
                  </div>
                  <DropdownMenuSeparator className="my-0 bg-border/30" />
                </li>
              )
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
