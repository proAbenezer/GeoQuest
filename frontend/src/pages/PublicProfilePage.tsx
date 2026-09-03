// pages/PublicProfilePage.tsx
// Any traveler's public profile (/users/:userId, ProtectedRoute). Identity +
// travel stats are open to every logged-in user; the public-pins gallery below
// stays audience-gated (owner's connections + followers only — the same rule
// that powers the map overlay). Self-visits redirect to /profile.
//
// The header action cluster mirrors PersonRow's request → accept connection
// model (Message when connected, Accept/Decline when they asked me, "Request
// sent" + Cancel when I asked, Connect otherwise), plus the independent
// Instagram-style Follow/Following toggle. After Accept/Follow the gallery
// unlocks in place (its feed refetches) without leaving the page.
import { useEffect, useRef, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Flame,
  Globe2,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Route as RouteIcon,
  User,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/context/AuthContext"
import { usePublicPins } from "@/hooks/usePublicPins"
import { useConversationUnread, openConversation } from "@/hooks/useConversations"
import {
  acceptConnection,
  connectUser,
  followUser,
  removeConnection,
  unfollowUser,
} from "@/hooks/useConnections"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import CommentSection from "@/components/comments/CommentSection"
import type { PublicPin } from "@/types/community"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

// The relation from the CALLER's perspective plus whether the profile owner
// follows the caller back (drives the "Follows you" chip).
type RelationPlus = {
  connected: boolean
  incomingPending: boolean
  outgoingPending: boolean
  following: boolean
  followsYou: boolean
}

const EMPTY_RELATION: RelationPlus = {
  connected: false,
  incomingPending: false,
  outgoingPending: false,
  following: false,
  followsYou: false,
}

function initialsOf(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?"
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short" })
}

const pinName = (p: { name: string; customName: string | null }) => p.customName || p.name

// Hero number tile — same glass card as the stats dashboard's tiles.
function KpiTile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof MapPin
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none tabular-nums text-foreground">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export default function PublicProfilePage() {
  const { userId = "" } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const unreadMessages = useConversationUnread()

  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading")
  const [bundle, setBundle] = useState<{
    user: {
      id: string
      username: string
      firstName: string
      lastName: string
      profileImage: string | null
      createdAt: string
    }
    followersCount: number
    followingCount: number
    stats: {
      countriesVisited: number
      totalPlaces: number
      totalDays: number
      longestStreakDays: number
    }
  } | null>(null)
  const [rel, setRel] = useState<RelationPlus>(EMPTY_RELATION)
  // Which single action is in flight (message/action/follow) — disables the row.
  const [busy, setBusy] = useState<"message" | "action" | "follow" | null>(null)
  // Disconnect/Decline/Cancel need a confirming second tap, like PersonRow.
  const [confirmRemove, setConfirmRemove] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isSelf = Boolean(user && user.id === userId)

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
    }
  }, [])

  const { pins, routePairs, loading: feedLoading, refresh: refreshFeed } = usePublicPins({
    ownerId: userId,
  })

  useEffect(() => {
    if (!user || isSelf) return
    let cancelled = false
    setStatus("loading")
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/user/${encodeURIComponent(userId)}`, {
          credentials: "include",
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.status === 404) {
          setStatus("missing")
          return
        }
        if (!res.ok) {
          setStatus("error")
          return
        }
        setBundle(data)
        setRel({
          connected: data.relation?.connected ?? false,
          incomingPending: data.relation?.incomingPending ?? false,
          outgoingPending: data.relation?.outgoingPending ?? false,
          following: data.relation?.following ?? false,
          followsYou: data.relation?.followsYou ?? false,
        })
        setStatus("ready")
      } catch {
        if (!cancelled) setStatus("error")
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user, userId, isSelf])

  // The owner's public gallery is only meaningful while we can see it.
  const canSeeContent = rel.connected || rel.following

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
      /* leave idle */
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
      setRel((r) => ({
        ...r,
        connected: result.connected,
        incomingPending: false,
        outgoingPending: result.pending,
      }))
      if (result.connected) void refreshFeed()
    }
  }

  const accept = async () => {
    if (busy) return
    setBusy("action")
    const ok = await acceptConnection(userId)
    setBusy(null)
    if (ok) {
      setRel((r) => ({ ...r, connected: true, incomingPending: false, outgoingPending: false }))
      void refreshFeed()
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
      setRel((r) => ({
        ...r,
        connected: false,
        incomingPending: false,
        outgoingPending: false,
      }))
      void refreshFeed()
    }
  }

  const cancelRequest = async () => {
    if (busy) return
    setBusy("action")
    const ok = await removeConnection(userId)
    setBusy(null)
    if (ok) {
      setRel((r) => ({ ...r, outgoingPending: false }))
    }
  }

  const toggleFollow = async () => {
    if (busy) return
    setBusy("follow")
    const ok = rel.following ? await unfollowUser(userId) : await followUser(userId)
    setBusy(null)
    if (ok) {
      setRel((r) => ({ ...r, following: !r.following }))
      void refreshFeed()
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/login")
    } catch {
      /* stay put */
    }
  }

  // Self-visits land on the user's own (editable) profile instead.
  if (isSelf) return <Navigate to="/profile" replace />

  const busyNow = busy !== null
  const owner = bundle?.user
  const initials = owner ? initialsOf(owner.firstName, owner.lastName) : ""

  return (
    <div className="min-h-screen bg-background">
      {/* ---- Top bar — mirrors the Stats page's sticky glass bar ---- */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border/40 bg-background/90 px-4 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="GeoQuest home">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
            <MapPin className="h-4 w-4" />
          </div>
          <span className="hidden font-heading text-lg font-semibold tracking-tight sm:inline">
            GeoQuest
          </span>
        </Link>
        <span className="hidden h-4 w-px bg-border/60 sm:block" />
        <h1 className="truncate text-sm font-semibold text-foreground">Traveler profile</h1>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Map</span>
          </Link>
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger
              nativeButton={false}
              render={
                <Avatar className="h-8 w-8 cursor-pointer rounded-lg bg-primary/10 text-primary shadow-sm transition-all hover:bg-primary/20">
                  <AvatarImage src={user?.profileImage} alt={user?.username ?? "Profile"} />
                  <AvatarFallback className="bg-transparent text-primary text-xs font-medium">
                    {user ? initialsOf(user.firstName ?? "", user.lastName ?? "") : "GQ"}
                  </AvatarFallback>
                </Avatar>
              }
            />
            <DropdownMenuContent
              align="end"
              className="rounded-xl border-border/40 bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60"
            >
              <DropdownMenuItem
                onClick={() => navigate("/profile")}
                className="gap-2 rounded-lg text-sm hover:bg-muted/40"
              >
                <User className="h-4 w-4" /> My profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/messages")}
                className="flex w-full items-center justify-between gap-2 rounded-lg text-sm hover:bg-muted/40"
              >
                <span className="inline-flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" /> Messages
                </span>
                {unreadMessages > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
                    {unreadMessages}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/40" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="gap-2 rounded-lg text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 md:px-6">
        {status === "loading" ? (
          <div className="flex min-h-[55vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : status === "missing" ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 p-6 text-center">
            <User className="h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Traveler not found</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              This profile may have been removed, or the link is wrong.
            </p>
            <Link to="/">
              <Button>Back to map</Button>
            </Link>
          </div>
        ) : status === "error" ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">Couldn't load this profile.</p>
            <Link to="/">
              <Button>Back to map</Button>
            </Link>
          </div>
        ) : owner ? (
          <>
            {/* ---- Identity + relation action cluster ---- */}
            <section className="rounded-xl border border-border/40 bg-card/60 p-5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 rounded-full border-4 border-background shadow-sm">
                    <AvatarImage src={owner.profileImage || undefined} alt={`${owner.firstName} ${owner.lastName}`} />
                    <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold leading-tight text-foreground">
                      {owner.firstName} {owner.lastName}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <p className="text-sm text-muted-foreground">@{owner.username}</p>
                      {rel.connected && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          <Check className="h-3 w-3" /> Connected
                        </span>
                      )}
                      {rel.followsYou && (
                        <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          Follows you
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Traveling since {formatDate(owner.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  {/* Connection axis */}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {rel.connected ? (
                      <>
                        <Button size="sm" onClick={startChat} disabled={busyNow} className="gap-1.5">
                          {busy === "message" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MessageCircle className="h-3.5 w-3.5" />
                          )}
                          Message
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={declineOrDisconnect}
                          disabled={busyNow}
                          className={`gap-1 text-muted-foreground hover:text-foreground ${
                            confirmRemove ? "text-destructive hover:text-destructive" : ""
                          }`}
                        >
                          {busy === "action" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : confirmRemove ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <UserMinus className="h-3.5 w-3.5" />
                          )}
                          {confirmRemove ? "Confirm disconnect" : "Disconnect"}
                        </Button>
                      </>
                    ) : rel.incomingPending ? (
                      <>
                        <Button size="sm" onClick={accept} disabled={busyNow} className="gap-1.5">
                          {busy === "action" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserPlus className="h-3.5 w-3.5" />
                          )}
                          Accept
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={declineOrDisconnect}
                          disabled={busyNow}
                          className={`gap-1 text-muted-foreground hover:text-foreground ${
                            confirmRemove ? "text-destructive hover:text-destructive" : ""
                          }`}
                        >
                          {confirmRemove ? "Confirm decline" : "Decline"}
                        </Button>
                      </>
                    ) : rel.outgoingPending ? (
                      <>
                        <Button variant="outline" size="sm" disabled className="gap-1 opacity-70">
                          <Check className="h-3.5 w-3.5" /> Request sent
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelRequest}
                          disabled={busyNow}
                          className="gap-1 text-muted-foreground hover:text-foreground"
                        >
                          {busy === "action" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
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
                        className="gap-1.5"
                      >
                        {busy === "action" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5" />
                        )}
                        Connect
                      </Button>
                    )}
                  </div>

                  {/* Follow axis — independent of connection, opens their gallery */}
                  <Button
                    variant={rel.following ? "outline" : "secondary"}
                    size="sm"
                    onClick={toggleFollow}
                    disabled={busyNow}
                    className="gap-1.5"
                  >
                    {busy === "follow" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : rel.following ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    {rel.following ? "Following" : "Follow"}
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border/40 pt-3 text-sm">
                <span>
                  <span className="font-bold tabular-nums text-foreground">{bundle.followersCount}</span>{" "}
                  <span className="text-muted-foreground">followers</span>
                </span>
                <span>
                  <span className="font-bold tabular-nums text-foreground">{bundle.followingCount}</span>{" "}
                  <span className="text-muted-foreground">following</span>
                </span>
              </div>
            </section>

            {/* ---- Travel KPIs (the owner's own /stats numbers) ---- */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiTile icon={Globe2} label="Countries explored" value={bundle.stats.countriesVisited} />
              <KpiTile icon={MapPin} label="Places unlocked" value={bundle.stats.totalPlaces} />
              <KpiTile icon={CalendarDays} label="Active days" value={bundle.stats.totalDays} />
              <KpiTile
                icon={Flame}
                label="Longest streak"
                value={bundle.stats.longestStreakDays > 0 ? `${bundle.stats.longestStreakDays}d` : "—"}
              />
            </div>

            <PublicGallery
              ownerName={`${owner.firstName} ${owner.lastName}`}
              canSee={canSeeContent}
              following={rel.following}
              connected={rel.connected}
              onFollow={toggleFollow}
              onConnect={connect}
              busy={busyNow}
              pins={pins}
              routePairs={routePairs}
              feedLoading={feedLoading}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}

// The owner's public pins + routes gallery. Server-gated: GET /pins/public
// returns nothing unless the viewer is connected or following, so we show the
// locked state whenever the relation says we're not in the audience.
function PublicGallery({
  ownerName,
  canSee,
  following,
  connected,
  onFollow,
  onConnect,
  busy,
  pins,
  routePairs,
  feedLoading,
}: {
  ownerName: string
  canSee: boolean
  following: boolean
  connected: boolean
  onFollow: () => void
  onConnect: () => void
  busy: boolean
  pins: PublicPin[]
  routePairs: { startPinId: string; endPinId: string }[]
  feedLoading: boolean
}) {
  const [selectedPin, setSelectedPin] = useState<PublicPin | null>(null)
  const pinById = new Map(pins.map((p) => [p.id, p]))

  return (
    <section className="rounded-xl border border-border/40 bg-card/60 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40">
      <header className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Globe2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Public pins &amp; routes
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
            {canSee ? `${ownerName}'s shared travels — comment to react` : "Shared with connections and followers"}
          </p>
        </div>
      </header>

      {!canSee ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            {following || connected
              ? `You can't see ${ownerName}'s public pins yet.`
              : `Follow or connect with ${ownerName} to see their public pins and routes.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {!following && (
              <Button size="sm" onClick={onFollow} disabled={busy} className="gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                {following ? "Following" : "Follow to unlock"}
              </Button>
            )}
            {!connected && (
              <Button size="sm" variant="outline" onClick={onConnect} disabled={busy} className="gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                Connect
              </Button>
            )}
          </div>
        </div>
      ) : feedLoading && pins.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : pins.length === 0 ? (
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          {ownerName} hasn't shared any public pins yet.
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {pins.map((pin) => {
              const display = pinName(pin)
              return (
                <button
                  key={pin.id}
                  type="button"
                  onClick={() => setSelectedPin(selectedPin?.id === pin.id ? null : pin)}
                  className={`group flex flex-col overflow-hidden rounded-xl border text-left transition-colors ${
                    selectedPin?.id === pin.id
                      ? "border-primary/50 ring-1 ring-primary/30"
                      : "border-border/50 hover:border-border"
                  }`}
                >
                  <div className="relative flex h-24 items-center justify-center overflow-hidden bg-muted/40">
                    {pin.imageUrl ? (
                      <img
                        src={pin.imageUrl}
                        alt={display}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <span className="text-primary/40">
                        <MapPin className="h-6 w-6" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 space-y-0.5 p-2.5">
                    <p className="truncate text-sm font-semibold text-foreground">{display}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{pin.description}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {routePairs.length > 0 && (
            <div className="mt-4 border-t border-border/40 pt-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <RouteIcon className="h-3.5 w-3.5" />
                Public routes ({routePairs.length})
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {routePairs.map(({ startPinId, endPinId }) => {
                  const start = pinById.get(startPinId)
                  const end = pinById.get(endPinId)
                  const label =
                    start && end
                      ? `${pinName(start)} → ${pinName(end)}`
                      : `${startPinId.slice(0, 6)} → ${endPinId.slice(0, 6)}`
                  return (
                    <span
                      key={`${startPinId}-${endPinId}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
                    >
                      <RouteIcon className="h-3 w-3 text-primary" />
                      {label}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Comment panel for the selected public pin (gated — the viewer is in
              the audience, so the existing CommentSection can post here). */}
          {selectedPin && (
            <div className="mt-4 rounded-xl border border-border/60 bg-background/40">
              <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
                <Globe2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {pinName(selectedPin)}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPin(null)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close comments"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-3">
                <CommentSection
                  key={selectedPin.id}
                  target={{
                    type: "pin",
                    pinId: selectedPin.id,
                    latitude: selectedPin.latitude,
                    longitude: selectedPin.longitude,
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
