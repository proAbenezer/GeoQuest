// pages/MessagesPage.tsx
// Private DM inbox. Standalone full-width route (ProtectedRoute only — no
// sidebar), matching /stats: a sticky top bar, then a two-pane layout — the
// conversation list on the left and the open thread on the right. On phones the
// two panes swap: the list is shown until a conversation is opened (via
// /messages/:id), then the thread fills the screen with a back button.
//
// Data comes from the community API through useConversations (REST + polling):
// the list refreshes every ~10s, an open thread polls new messages every ~5s.
import { useEffect, useRef, useState } from "react"
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
import {
  openConversation,
  useChatThread,
  useConversationList,
} from "@/hooks/useConversations"
import { searchUsers, useConnections } from "@/hooks/useConnections"
import { PersonRow } from "@/components/community/PersonRow"
import type { ConversationSummary, UserSearchResult } from "@/types/community"

type LeftTab = "chats" | "people"

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

// Caption for a followed user in the People tab ("3 places in common · follows
// you"). A mutual follow surfaces as "follows you back".
function connectionSubtitle(c: { sharedPlaces: number; followsMe: boolean }): string {
  const parts: string[] = []
  if (c.sharedPlaces > 0) {
    parts.push(`${c.sharedPlaces} place${c.sharedPlaces === 1 ? "" : "s"} in common`)
  }
  if (c.followsMe) parts.push("follows you back")
  return parts.join(" · ")
}

export default function MessagesPage() {
  const { conversationId } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { conversations, loading } = useConversationList()
  const activeId = conversationId ?? null
  const active = conversations.find((c) => c.id === activeId) ?? null
  const thread = useChatThread(activeId)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Left-pane surfaces: find any traveler by username, or browse the people you
  // already follow.
  const [leftTab, setLeftTab] = useState<LeftTab>("chats")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const { connections, loading: peopleLoading, removeConnection } = useConnections()

  const searchActive = searchQuery.trim().length >= 2

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

  // Open (or reuse) a thread with any searched traveler, then jump into it.
  const openThreadWith = async (otherUserId: string) => {
    try {
      const convo = await openConversation(otherUserId)
      setSearchQuery("")
      setSearchResults([])
      setLeftTab("chats")
      navigate(`/messages/${convo.id}`)
    } catch {
      /* conversation failed to open — the list stays put */
    }
  }

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

  const peopleContent =
    peopleLoading && connections.length === 0 ? (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ) : connections.length === 0 ? (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <Users className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">You're not following anyone yet.</p>
        <p className="max-w-[16rem] text-xs text-muted-foreground/70">
          Connect with travelers who've been where you've been — on your stats
          board or from a place's People list.
        </p>
        <Link to="/stats">
          <Button size="sm">See co-travelers</Button>
        </Link>
      </div>
    ) : (
      <ul className="flex flex-col">
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
            onUnfollowed={(id) => removeConnection(id)}
          />
        ))}
      </ul>
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
    const ok = await thread.send(text)
    setSending(false)
    if (ok) setDraft("")
    else setSendError("Couldn't send the message — check your connection and try again.")
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
                onClick={() => navigate("/stats")}
                className="gap-2 rounded-lg text-sm hover:bg-muted/40"
              >
                Stats
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/profile")}
                className="gap-2 rounded-lg text-sm hover:bg-muted/40"
              >
                <User className="h-4 w-4" /> Profile
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

          {/* Chats | People */}
          <div className="flex items-center gap-1 border-b border-border/40 px-3">
            {(["chats", "people"] as const).map((tab) => (
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
                ) : (
                  <Users className="h-3.5 w-3.5" />
                )}
                {tab === "chats" ? "Chats" : "People"}
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
                <ul className="flex flex-col">
                  {searchResults.map((r) => (
                    <li key={r.userId}>
                      <button
                        type="button"
                        onClick={() => void openThreadWith(r.userId)}
                        className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                      >
                        <Avatar className="h-9 w-9 shrink-0 rounded-full bg-muted text-xs text-muted-foreground">
                          <AvatarImage
                            src={r.profileImage ?? undefined}
                            alt={`${r.firstName} ${r.lastName}`}
                          />
                          <AvatarFallback className="bg-transparent">
                            {initialsOf(r.firstName, r.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {`${r.firstName} ${r.lastName}`.trim()}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            @{r.username}
                          </p>
                        </div>
                        <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : leftTab === "people" ? (
              peopleContent
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
            </>
          )}
        </section>
      </div>
    </div>
  )
}
