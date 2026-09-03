// components/community/PersonRow.tsx
// One person row in a community list: avatar, full name + @username, a caption
// (e.g. "3 places in common"), and relation-aware actions driven by the
// request → accept connection model:
//   connected        -> Message (opens/reuses the 1:1 DM) + Disconnect
//   incomingPending  -> Accept + Decline (they asked me)
//   outgoingPending  -> "Request sent" (disabled) + Cancel
//   none             -> Connect
// Used by the stats board's co-travelers panel, the Messages → People tab, the
// per-place People list, and search results — so connection UX looks and behaves
// the same everywhere.
//
// The row owns its own relation state so an action in one place is immediately
// reflected there without a refetch. `onChanged` fires after any successful
// server-side change so a parent that shows a derived list (friends, requests)
// can refresh. Disconnect/Decline/Cancel deliberately need a second tap to
// confirm, so an accidental tap can't sever a friendship.
import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Loader2, MessageCircle, UserPlus, UserMinus, Check, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  acceptConnection,
  connectUser,
  removeConnection,
} from "@/hooks/useConnections"
import { openConversation } from "@/hooks/useConversations"

function initialsOf(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?"
}

type Relation = {
  connected: boolean
  incomingPending: boolean
  outgoingPending: boolean
}

export function PersonRow({
  userId,
  firstName,
  lastName,
  username,
  profileImage,
  connected: initiallyConnected = false,
  incomingPending: initiallyIncoming = false,
  outgoingPending: initiallyOutgoing = false,
  subtitle,
  compact = false,
  onChanged,
}: {
  userId: string
  firstName: string
  lastName: string
  username?: string
  profileImage: string | null
  /** Server-reported relation state for this user (mutual-accepted → connected). */
  connected?: boolean
  incomingPending?: boolean
  outgoingPending?: boolean
  /** Caption under the name, e.g. "3 places in common". */
  subtitle?: string
  /** Compact sizing for narrow panels (the per-place People list). */
  compact?: boolean
  /** Fired after any successful relation change (accept/decline/connect/…). */
  onChanged?: () => void
}) {
  const navigate = useNavigate()
  const name = `${firstName} ${lastName}`.trim()
  const [rel, setRel] = useState<Relation>({
    connected: initiallyConnected,
    incomingPending: initiallyIncoming,
    outgoingPending: initiallyOutgoing,
  })
  const [busy, setBusy] = useState<"message" | "action" | null>(null)
  // Disconnect/Decline/Cancel require a confirming second tap.
  const [confirmRemove, setConfirmRemove] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
    }
  }, [])

  const armConfirm = () => {
    setConfirmRemove(true)
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    confirmTimer.current = setTimeout(() => setConfirmRemove(false), 3000)
  }

  const startChat = async () => {
    setBusy("message")
    try {
      const convo = await openConversation(userId)
      navigate(`/messages/${convo.id}`)
    } catch {
      /* conversation opening failed — leave the row idle */
    } finally {
      setBusy(null)
    }
  }

  const connect = async () => {
    if (busy) return
    setBusy("action")
    const result = await connectUser(userId)
    setBusy(null)
    if (result) {
      setRel({ connected: result.connected, incomingPending: false, outgoingPending: result.pending })
      onChanged?.()
    }
  }

  const accept = async () => {
    if (busy) return
    setBusy("action")
    const ok = await acceptConnection(userId)
    setBusy(null)
    if (ok) {
      setRel({ connected: true, incomingPending: false, outgoingPending: false })
      onChanged?.()
    }
  }

  const declineOrDisconnect = async () => {
    if (busy) return
    if (!confirmRemove) {
      armConfirm()
      return
    }
    setBusy("action")
    const ok = await removeConnection(userId)
    setBusy(null)
    setConfirmRemove(false)
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    if (ok) {
      setRel({ connected: false, incomingPending: false, outgoingPending: false })
      onChanged?.()
    }
  }

  const cancelRequest = async () => {
    if (busy) return
    setBusy("action")
    const ok = await removeConnection(userId)
    setBusy(null)
    if (ok) {
      setRel({ connected: false, incomingPending: false, outgoingPending: false })
      onChanged?.()
    }
  }

  const busyNow = busy !== null

  return (
    <li className="flex items-center gap-2.5 py-2">
      {/* Avatar + name open the traveler's public profile */}
      <Link
        to={`/users/${userId}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg transition-colors hover:bg-muted/40"
        aria-label={`View ${name}'s profile`}
      >
        <Avatar
          className={cn(
            "shrink-0 rounded-full bg-muted text-muted-foreground",
            compact ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-xs"
          )}
        >
          <AvatarImage src={profileImage ?? undefined} alt={name} />
          <AvatarFallback className="bg-transparent">{initialsOf(firstName, lastName)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {name}
            {username && (
              <span className="ml-1.5 font-normal text-muted-foreground">@{username}</span>
            )}
          </span>
          {subtitle && (
            <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
          )}
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">
        {rel.connected ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={startChat}
              disabled={busyNow}
              className="h-7 gap-1 px-2 text-xs"
            >
              {busy === "message" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <MessageCircle className="h-3 w-3" />
              )}
              Message
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={declineOrDisconnect}
              disabled={busyNow}
              className={cn(
                "h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground",
                confirmRemove && "text-destructive hover:text-destructive"
              )}
            >
              {busy === "action" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : confirmRemove ? (
                <Check className="h-3 w-3" />
              ) : (
                <UserMinus className="h-3 w-3" />
              )}
              {confirmRemove ? "Confirm" : "Disconnect"}
            </Button>
          </>
        ) : rel.incomingPending ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={accept}
              disabled={busyNow}
              className="h-7 gap-1 px-2 text-xs"
            >
              {busy === "action" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <UserPlus className="h-3 w-3" />
              )}
              Accept
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={declineOrDisconnect}
              disabled={busyNow}
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {confirmRemove ? "Confirm" : "Decline"}
            </Button>
          </>
        ) : rel.outgoingPending ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled
              className="h-7 gap-1 px-2 text-xs opacity-70"
            >
              <Check className="h-3 w-3" />
              Request sent
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelRequest}
              disabled={busyNow}
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {busy === "action" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={connect}
            disabled={busyNow}
            className="h-7 gap-1 px-2 text-xs"
          >
            {busy === "action" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <UserPlus className="h-3 w-3" />
            )}
            Connect
          </Button>
        )}
      </div>
    </li>
  )
}
