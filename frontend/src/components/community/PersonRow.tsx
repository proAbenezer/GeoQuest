// components/community/PersonRow.tsx
// One person row in a community list: avatar, full name + @username, a caption
// (e.g. "3 places in common"), a Message button that opens/reuses a 1:1 DM and
// jumps into it, and a Connect/Connected toggle. Used by the stats board's
// co-travelers panel, the Messages → People tab, and (compact variant) the
// per-place People list — so "connect" looks and behaves the same everywhere.
//
// The row owns its own follow state so a toggle in one place is immediately
// reflected there without a refetch. `onUnfollowed` lets a list that only shows
// followed people (People tab) drop the row after an unfollow.
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, MessageCircle, UserPlus, Check } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { followUser, unfollowUser } from "@/hooks/useConnections"
import { openConversation } from "@/hooks/useConversations"

function initialsOf(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?"
}

export function PersonRow({
  userId,
  firstName,
  lastName,
  username,
  profileImage,
  connected: initiallyConnected,
  subtitle,
  compact = false,
  onUnfollowed,
}: {
  userId: string
  firstName: string
  lastName: string
  username?: string
  profileImage: string | null
  connected: boolean
  /** Caption under the name, e.g. "3 places in common" or "follows you". */
  subtitle?: string
  /** Compact sizing for narrow panels (the per-place People list). */
  compact?: boolean
  /** Called after a successful unfollow (so People lists can remove the row). */
  onUnfollowed?: (userId: string) => void
}) {
  const navigate = useNavigate()
  const name = `${firstName} ${lastName}`.trim()
  const [connected, setConnected] = useState(initiallyConnected)
  const [busy, setBusy] = useState<"message" | "follow" | null>(null)

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

  const toggleFollow = async () => {
    setBusy("follow")
    const wasConnected = connected
    const ok = wasConnected ? await unfollowUser(userId) : await followUser(userId)
    setBusy(null)
    if (ok) {
      setConnected(!wasConnected)
      // The People tab only lists people I follow — drop the row on unfollow.
      if (wasConnected) onUnfollowed?.(userId)
    }
  }

  return (
    <li className="flex items-center gap-2.5 py-2">
      <Avatar
        className={cn(
          "shrink-0 rounded-full bg-muted text-muted-foreground",
          compact ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-xs"
        )}
      >
        <AvatarImage src={profileImage ?? undefined} alt={name} />
        <AvatarFallback className="bg-transparent">{initialsOf(firstName, lastName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {name}
          {username && (
            <span className="ml-1.5 font-normal text-muted-foreground">@{username}</span>
          )}
        </p>
        {subtitle && (
          <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={startChat}
          disabled={busy !== null}
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
          variant={connected ? "ghost" : "secondary"}
          size="sm"
          onClick={toggleFollow}
          disabled={busy !== null}
          className={cn(
            "h-7 gap-1 px-2 text-xs",
            connected && "text-muted-foreground hover:text-foreground"
          )}
        >
          {busy === "follow" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : connected ? (
            <Check className="h-3 w-3" />
          ) : (
            <UserPlus className="h-3 w-3" />
          )}
          {connected ? "Connected" : "Connect"}
        </Button>
      </div>
    </li>
  )
}
