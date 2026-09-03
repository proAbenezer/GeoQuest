// pages/MessagesPage.tsx
// Private DM inbox. Standalone full-width route (ProtectedRoute only — no
// sidebar), matching /stats: a sticky top bar, then a two-pane layout — the
// conversation list on the left and the open thread on the right. On phones the
// two panes swap: the list is shown until a conversation is opened (via
// /messages/:id), then the thread fills the screen with a back button.
//
// Data comes from the community API through useConversations (REST + polling):
// the list refreshes every ~10s, an open thread polls new messages every ~5s.
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  MapPin,
  ArrowLeft,
  Loader2,
  Send,
  LogOut,
  User,
  MessageCircle,
  Inbox,
  Search,
  Users,
  X,
  UserPlus,
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
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"
import { useChatThread, useConversationList } from "@/hooks/useConversations"
import { useMyGroups } from "@/hooks/useGroups"
import {
  connectUser,
  searchUsers,
  useConnectionRequests,
  useConnections,
} from "@/hooks/useConnections"
import { PersonRow } from "@/components/community/PersonRow"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import type { ConversationSummary, UserSearchResult } from "@/types/community"

type LeftTab = "chats" | "groups" | "people"

function initialsOf(first?: string, last?: string): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?"
}

function fullName(c: ConversationSummary | null): string {
  const w = c?.withUser
  if (!w) return "Traveler"
  return `${w.firstName} ${w.lastName}`.trim()
}

function clock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

// Compact "last activity" label for the list rows.
function listTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 60_000) return "now"
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m`
  if (d.toDateString() === now.toDateString()) return clock(iso)
  if (now.getTime() - d.getTime() < 7 * 86_400_000)
    return d.toLocaleDateString(undefined, { weekday: "short" })
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// Caption for a connected user in the People tab ("3 places in common"). The
// Messages view only lists users I'm connected to (mutual accept).
function connectionSubtitle(c: { sharedPlaces: number }): string {
  const parts: string[] = []
  if (c.sharedPlaces > 0) {
    parts.push(`${c.sharedPlaces} place${c.sharedPlaces === 1 ? "" : "s"} in common`)
  }
  return parts.join(" · ")
}

export default function MessagesPage() {
  const { conversationId } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { conversations, loading } = useConversationList()
  const { groups: myGroups, loading: groupsLoading } = useMyGroups()
  const activeId = conversationId ?? null
  const active = conversations.find((c) => c.id === activeId) ?? null
  const thread = useChatThread(activeId)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  // When the peer of an open thread is no longer a connection (they disconnected
  // or the request lapsed), the composer is replaced by a reconnect prompt.
  const [reconnectSent, setReconnectSent] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Left-pane surfaces: find any traveler by username, or browse the people you
  // already follow.
  const [leftTab, setLeftTab] = useState<LeftTab>("chats")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const { connections, loading: peopleLoading, refresh: refreshConnections } = useConnections()
  const { incoming, outgoing, refresh: refreshRequests } = useConnectionRequests()
  const connectionsById = useMemo(
    () => new Map(connections.map((c) => [c.userId, c])),
    [connections]
  )

  const searchActive = searchQuery.trim().length >= 2

  // After a request accept/decline in the People tab or search results, the
  // friend + requests lists and the current thread's connect-gate all need the
  // fresh relation state.
  const refreshRelations = () => {
    void refreshConnections()
    void refreshRequests()
  }

  // ---- Connect-gate for an open thread ----
  // The server forbids messaging anyone you're not connected to. If the peer of
  // the open conversation dropped off the connections list (they disconnected,
  // or a fresh request is still pending), swap the composer for a reconnect
  // prompt instead of letting sends fail with a 403.
  const activePeer = active?.withUser ?? thread.withUser ?? null
  const activePeerId = activePeer?.userId ?? null
  const activePeerName = activePeer
    ? `${activePeer.firstName} ${activePeer.lastName}`.trim() || "this traveler"
    : "this traveler"
  // While the connections list is still loading, don't gate — treat the peer as
  // connected until we actually know they're gone.
  const activePeerConnected = activePeerId
    ? peopleLoading || connectionsById.has(activePeerId)
    : true

  // Reset the transient "request sent" copy whenever the thread changes.
  useEffect(() => {
    setReconnectSent(false)
  }, [activeId])

  const reconnectToPeer = async () => {
    if (!activePeerId || reconnectSent) return
    const result = await connectUser(activePeerId)
    if (result?.connected) {
      // They'd actually asked me while I wasn't looking — accept = connected.
      setReconnectSent(false)
      refreshRelations()
    } else if (result?.pending) {
      setReconnectSent(true)
    }
  }

  // Debounced username/name search (mirrors the Navbar's Mapbox search cadence).
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      const results = await searchUsers(searchQuery)
      setSearchResults(results)
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const clearSearch = () => {
    setSearchQuery("")
    setSearchResults([])
    setSearching(false)
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    // Mark busy immediately so the results area shows a spinner (not a stale
    // "no matches") during the debounce window before the first fetch lands.
    if (value.trim().length >= 2) setSearching(true)
  }

  // ---- Left-pane content builders ----
  const chatsContent =
    loading && conversations.length === 0 ? (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ) : conversations.length === 0 ? (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No conversations yet.</p>
        <Link to="/">
          <Button size="sm">Explore the map</Button>
        </Link>
        <p className="max-w-[16rem] text-xs text-muted-foreground/70">
          Open a place you've visited and tap <span className="font-medium">Message</span>{" "}
          on someone who's been there too.
        </p>
      </div>
    ) : (
      <ul className="flex flex-col">
        {conversations.map((c) => {
          const isActive = c.id === activeId
          const mine = c.lastMessage && c.lastMessage.authorUserId === user?.id
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => navigate(`/messages/${c.id}`)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                  isActive && "bg-muted/60"
                )}
              >
                <Avatar className="h-9 w-9 shrink-0 rounded-full bg-muted text-xs text-muted-foreground">
                  <AvatarImage
                    src={c.withUser?.profileImage ?? undefined}
                    alt={fullName(c)}
                  />
                  <AvatarFallback className="bg-transparent">
                    {initialsOf(c.withUser?.firstName, c.withUser?.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {fullName(c)}
                    </p>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {listTime(c.lastMessage?.createdAt ?? c.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {c.lastMessage
                        ? `${mine ? "You: " : ""}${c.lastMessage.body}`
                        : "No messages yet"}
                    </p>
                    {c.unreadCount > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    )

  const peopleLoadingOrEmpty =
    peopleLoading && connections.length === 0 && incoming.length === 0 && outgoing.length === 0
  const noPeople =
    !peopleLoading && connections.length === 0 && incoming.length === 0 && outgoing.length === 0

  const peopleContent =
    peopleLoadingOrEmpty ? (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ) : noPeople ? (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <Users className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No connections yet.</p>
        <p className="max-w-[16rem] text-xs text-muted-foreground/70">
          Connect with travelers who've been where you've been — on your stats
          board or from a place's People list — and they'll appear here once
          they accept.
        </p>
        <Link to="/stats">
          <Button size="sm">See co-travelers</Button>
        </Link>
      </div>
    ) : (
      <div className="flex flex-col">
        {incoming.length > 0 && (
          <div className="border-b border-border/40">
            <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Requests
            </p>
            <ul className="flex flex-col divide-y divide-border/40 px-4">
              {incoming.map((p) => (
                <PersonRow
                  key={p.userId}
                  userId={p.userId}
                  firstName={p.firstName}
                  lastName={p.lastName}
                  username={p.username}
                  profileImage={p.profileImage}
                  incomingPending
                  subtitle="wants to connect"
                  onChanged={refreshRelations}
                />
              ))}
            </ul>
          </div>
        )}
        {outgoing.length > 0 && (
          <div className="border-b border-border/40">
            <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sent
            </p>
            <ul className="flex flex-col divide-y divide-border/40 px-4">
              {outgoing.map((p) => (
                <PersonRow
                  key={p.userId}
                  userId={p.userId}
                  firstName={p.firstName}
                  lastName={p.lastName}
                  username={p.username}
                  profileImage={p.profileImage}
                  outgoingPending
                  subtitle="request sent"
                  onChanged={refreshRelations}
                />
              ))}
            </ul>
          </div>
        )}
        {connections.length > 0 && (
          <div>
            <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Connections
            </p>
            <ul className="flex flex-col divide-y divide-border/40 px-4">
              {connections.map((p) => (
                <PersonRow
                  key={p.userId}
                  userId={p.userId}
                  firstName={p.firstName}
                  lastName={p.lastName}
                  username={p.username}
                  profileImage={p.profileImage}
                  connected
                  subtitle={connectionSubtitle(p)}
                  onChanged={refreshRelations}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    )

  // Co-traveler group inbox — rows open the group's full chat page; "+ New
  // group" opens the create screen inside Messages (name, photo, linked place).
  const groupsContent =
    groupsLoading && myGroups.length === 0 ? (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ) : myGroups.length === 0 ? (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <Users className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No groups yet.</p>
        <p className="max-w-[16rem] text-xs text-muted-foreground/70">
          Create a group to plan a trip with travelers you've crossed paths with —
          name it, add a photo and a linked place, then invite people.
        </p>
        <Link to="/messages/new-group">
          <Button size="sm" className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Create a group
          </Button>
        </Link>
      </div>
    ) : (
      <>
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {myGroups.length} group{myGroups.length === 1 ? "" : "s"}
          </p>
          <Link
            to="/messages/new-group"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
          >
            <UserPlus className="h-3.5 w-3.5" />
            New group
          </Link>
        </div>
        <ul className="flex flex-col">
        {myGroups.map((g) => {
          const mine = g.lastMessage && g.lastMessage.authorUserId === user?.id
          const sender = g.lastMessage?.author
            ? `${g.lastMessage.author.firstName}${g.lastMessage.author.lastName ? ` ${g.lastMessage.author.lastName}` : ""}`
            : ""
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => navigate(`/messages/groups/${g.id}`)}
                className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <Avatar className="h-9 w-9 shrink-0 rounded-full bg-muted text-xs text-muted-foreground">
                  <AvatarImage
                    src={g.imageUrl ?? g.createdBy?.profileImage ?? undefined}
                    alt={g.name}
                  />
                  <AvatarFallback className="bg-transparent">
                    <Users className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{g.name}</p>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {listTime(g.lastMessage?.createdAt ?? g.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {g.lastMessage
                        ? `${mine ? "You: " : sender ? `${sender}: ` : ""}${g.lastMessage.body}`
                        : `${g.memberCount} member${g.memberCount === 1 ? "" : "s"} — no messages yet`}
                    </p>
                    {g.unreadCount > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
                        {g.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
        </ul>
      </>
    )

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread.messages.length, activeId])

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/login")
    } catch {
      /* stay put */
    }
  }

  const submit = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setSendError(null)
    const res = await thread.send(text)
    setSending(false)
    if (res.ok) {
      setDraft("")
    } else {
      // A failed send is almost always the peer having disconnected mid-thread
      // (the server 403s once the mutual connection is gone). Refresh the
      // relations so the composer is replaced by the reconnect prompt instead of
      // letting the next attempt hit the same 403.
      setSendError(res.error ?? "Couldn't send the message — try again.")
      refreshRelations()
    }
  }

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : "GQ"

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ---- Top bar (mirrors StatsPage) ---- */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border/40 bg-background/90 px-4 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="GeoQuest home">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
            <MapPin className="h-4 w-4" />
          </div>
          <span className="hidden font-heading text-lg font-semibold tracking-tight sm:inline">
            GeoQuest
          </span>
        </Link>
        <span className="hidden h-4 w-px bg-border/60 sm:block" />
        <h1 className="text-sm font-semibold text-foreground">Messages</h1>
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
                    {initials}
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
                <User className="h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/stats")}
                className="gap-2 rounded-lg text-sm hover:bg-muted/40"
              >
                Stats
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

      <div className="flex min-h-0 flex-1">
        {/* ---- Left pane: search + Chats/People ---- */}
        <aside
          className={cn(
            "w-full flex-col border-r border-border/40 md:flex md:w-80",
            activeId ? "hidden" : "flex"
          )}
        >
          {/* Find any registered traveler by username or full name */}
          <div className="border-b border-border/40 p-3 pb-2.5">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
              <input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search travelers…"
                className="w-full rounded-lg border border-border/40 bg-card/40 py-1.5 pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
              />
              {searching ? (
                <Loader2 className="absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground/70" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Chats | Groups | People */}
          <div className="flex items-center gap-1 border-b border-border/40 px-3">
            {(["chats", "groups", "people"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setLeftTab(tab)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  leftTab === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "chats" ? (
                  <MessageCircle className="h-3.5 w-3.5" />
                ) : tab === "groups" ? (
                  <Users className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
                {tab === "chats" ? "Chats" : tab === "groups" ? "Groups" : "People"}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {searchActive ? (
              searching && searchResults.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-6 text-center">
                  <Search className="h-6 w-6 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No travelers match “{searchQuery.trim()}”.
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Search by username or full name.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col divide-y divide-border/40 px-4">
                  {searchResults.map((r) => (
                    <PersonRow
                      key={r.userId}
                      userId={r.userId}
                      firstName={r.firstName}
                      lastName={r.lastName}
                      username={r.username}
                      profileImage={r.profileImage}
                      connected={r.connected}
                      incomingPending={r.incomingPending}
                      outgoingPending={r.outgoingPending}
                      onChanged={refreshRelations}
                    />
                  ))}
                </ul>
              )
            ) : leftTab === "people" ? (
              peopleContent
            ) : leftTab === "groups" ? (
              groupsContent
            ) : (
              chatsContent
            )}
          </div>
        </aside>

        {/* ---- Thread ---- */}
        <section
          className={cn(
            "min-w-0 flex-1 flex-col",
            activeId ? "flex" : "hidden md:flex"
          )}
        >
          {!activeId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Pick a conversation</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Choose a conversation to start chatting, or find travelers on the map and message
                them from a place you've both visited.
              </p>
              <Link to="/">
                <Button>Find travelers</Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/messages")}
                  className="md:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-9 w-9 rounded-full bg-muted text-xs text-muted-foreground">
                  <AvatarImage src={thread.withUser?.profileImage ?? undefined} alt={fullName(active)} />
                  <AvatarFallback className="bg-transparent">
                    {initialsOf(thread.withUser?.firstName, thread.withUser?.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{fullName(active)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {thread.withUser ? "Traveler" : "Connecting…"}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {thread.loading && thread.messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : thread.messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      No messages yet — say hi 👋
                    </p>
                  </div>
                ) : (
                  thread.messages.map((m) => {
                    const mine = m.authorUserId === user?.id
                    return (
                      <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                        <div
                          className={cn(
                            "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                            mine
                              ? "rounded-br-sm bg-primary text-primary-foreground"
                              : "rounded-bl-sm border border-border/40 bg-card/70 text-foreground"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        </div>
                        <span
                          className={cn(
                            "mt-0.5 px-1 text-[10px] tabular-nums",
                            mine ? "text-primary-foreground/60" : "text-muted-foreground/60"
                          )}
                        >
                          {clock(m.createdAt)}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Composer */}
              {sendError && (
                <p className="border-t border-border/40 px-4 pt-2 text-xs text-destructive">
                  {sendError}
                </p>
              )}
              {activePeerId && !activePeerConnected ? (
                <div className="flex items-center justify-between gap-3 border-t border-border/40 px-4 py-3">
                  <div className="min-w-0">
                    {reconnectSent ? (
                      <p className="text-sm text-muted-foreground">
                        Request sent — waiting for {activePeerName} to accept.
                      </p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-foreground">
                          You're no longer connected with {activePeerName}.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Reconnect to keep sending messages — your history stays.
                        </p>
                      </>
                    )}
                  </div>
                  {!reconnectSent && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void reconnectToPeer()}
                      className="shrink-0 gap-1.5"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Connect again
                    </Button>
                  )}
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void submit()
                  }}
                  className="flex items-center gap-2 border-t border-border/40 p-3"
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a message…"
                    maxLength={4000}
                    autoFocus
                    className="min-w-0 flex-1 rounded-xl border border-border/40 bg-card/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!draft.trim() || sending}
                    className="shrink-0 rounded-xl"
                    aria-label="Send"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
