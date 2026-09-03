// pages/NewGroupPage.tsx
// Create a co-traveler group (/messages/new-group, ProtectedRoute). This is the
// single home for "make a group" — reached from the Messages Groups tab and the
// stats board's co-travelers — instead of the old create-in-stats modal that
// dumped you straight into an empty chat. Choosing a profile (photo + name) and
// an optional linked public place happens HERE, then you land in the chat.
//
// Members are optional direct-adds: search any registered traveler, or arrive
// pre-selected from the stats board (router state.travelers, the visible
// co-travelers). Search + roster follow the same patterns as GroupChatPage's
// "Add people" panel.
import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Loader2,
  LogOut,
  MapPin,
  Search,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"
import GroupProfileFields, {
  type GroupProfileValue,
} from "@/components/groups/GroupProfileFields"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { createGroup } from "@/hooks/useGroups"
import { searchUsers } from "@/hooks/useConnections"
import type { FellowTraveler, UserSearchResult } from "@/types/community"

type MemberPick = {
  userId: string
  firstName: string
  lastName: string
  profileImage: string | null
}

const MAX_ADD = 50

function initialsOf(first?: string, last?: string): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?"
}

function toPick(t: { userId: string; firstName: string; lastName: string; profileImage: string | null }): MemberPick {
  return { userId: t.userId, firstName: t.firstName, lastName: t.lastName, profileImage: t.profileImage }
}

export default function NewGroupPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Travelers pre-selected when arriving from the stats board (the visible
  // co-travelers). Captured once so back/forward doesn't re-add them.
  const preselect = (
    (location.state as { travelers?: FellowTraveler[] } | null)?.travelers ?? []
  ).filter((t) => t.userId !== user?.id)

  const [profile, setProfile] = useState<GroupProfileValue>({
    name: "",
    imageUrl: null,
    pin: null,
  })
  const [members, setMembers] = useState<MemberPick[]>(() => preselect.map(toPick))

  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const memberIds = new Set(members.map((m) => m.userId))

  const runSearch = async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const found = await searchUsers(q)
    setResults(found)
    setSearching(false)
  }

  const addMember = (r: MemberPick) => {
    if (memberIds.has(r.userId) || members.length >= MAX_ADD) return
    setMembers((prev) => [...prev, r])
  }

  const removeMember = (userId: string) => {
    setMembers((prev) => prev.filter((m) => m.userId !== userId))
  }

  const create = async () => {
    const name = profile.name.trim()
    if (creating) return
    if (!name) return setError("Give the group a name")
    setCreating(true)
    setError(null)
    const created = await createGroup(
      name,
      members.map((m) => m.userId),
      { imageUrl: profile.imageUrl, pinId: profile.pin?.id ?? null }
    )
    setCreating(false)
    if (!created) {
      setError("Couldn't create the group — try again.")
      return
    }
    navigate(`/messages/groups/${created.id}`)
  }

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/login")
    } catch {
      /* stay put */
    }
  }

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : "GQ"
  const showResults = query.trim().length >= 2
  const filteredResults = results.filter((r) => !memberIds.has(r.userId) && r.userId !== user?.id)

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ---- Top bar (mirrors MessagesPage) ---- */}
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
        <h1 className="text-sm font-semibold text-foreground">New group</h1>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/messages"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Messages</span>
          </Link>
          <NotificationBell />
          <DropdownAvatar initials={initials} image={user?.profileImage} onLogout={handleLogout} navigate={navigate} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg px-4 py-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">Start a group chat</h2>
            <p className="text-sm text-muted-foreground">
              Give it a name, add a photo and a linked place — members can be
              added now or later from the chat.
            </p>
          </div>

          <div className="space-y-5">
            {/* Profile: photo + name + linked place */}
            <section className="rounded-2xl border border-border/40 bg-card/40 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Group profile
              </h3>
              <GroupProfileFields value={profile} onChange={setProfile} />
            </section>

            {/* Members */}
            <section className="rounded-2xl border border-border/40 bg-card/40 p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Members · optional
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {members.length} added
                </span>
              </div>

              <div className="relative mb-2">
                <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    if (e.target.value.trim().length >= 2) setSearching(true)
                    void runSearch(e.target.value)
                  }}
                  placeholder="Search travelers to add…"
                  className="w-full rounded-lg border border-border/40 bg-card/60 py-1.5 pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("")
                      setResults([])
                      setSearching(false)
                    }}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              {showResults ? (
                searching && filteredResults.length === 0 ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredResults.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">
                    No travelers match “{query.trim()}”.
                  </p>
                ) : (
                  <ul className="mb-2 max-h-48 divide-y divide-border/30 overflow-y-auto rounded-xl border border-border/40">
                    {filteredResults.map((r) => (
                      <li key={r.userId}>
                        <button
                          type="button"
                          onClick={() =>
                            addMember({
                              userId: r.userId,
                              firstName: r.firstName,
                              lastName: r.lastName,
                              profileImage: r.profileImage,
                            })
                          }
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                        >
                          <Avatar className="h-8 w-8 rounded-full bg-muted text-[11px] text-muted-foreground">
                            <AvatarImage src={r.profileImage ?? undefined} alt={`${r.firstName} ${r.lastName}`} />
                            <AvatarFallback className="bg-transparent">
                              {initialsOf(r.firstName, r.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {r.firstName} {r.lastName}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">@{r.username}</span>
                          </span>
                          <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <p className="mb-2 px-1 text-xs text-muted-foreground/70">
                  {members.length === 0
                    ? "Anyone you add joins instantly — no connection needed. You can also add people later from inside the chat."
                    : "Search above to add more, or keep going with who's here."}
                </p>
              )}

              {members.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {members.map((m) => (
                    <li key={m.userId}>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background py-1 pr-1 pl-1 text-sm">
                        <Avatar className="h-6 w-6 rounded-full bg-muted text-[10px] text-muted-foreground">
                          <AvatarImage src={m.profileImage ?? undefined} alt={`${m.firstName} ${m.lastName}`} />
                          <AvatarFallback className="bg-transparent">
                            {initialsOf(m.firstName, m.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="max-w-[10rem] truncate font-medium text-foreground">
                          {m.firstName}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMember(m.userId)}
                          aria-label={`Remove ${m.firstName}`}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => navigate("/messages")}>
                Cancel
              </Button>
              <Button
                onClick={() => void create()}
                disabled={creating || !profile.name.trim()}
                className="gap-1.5"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                {creating ? "Creating…" : "Create group"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// The avatar dropdown (Profile / Stats / Log out), matching MessagesPage.
function DropdownAvatar({
  initials,
  image,
  onLogout,
  navigate,
}: {
  initials: string
  image?: string | null
  onLogout: () => void
  navigate: ReturnType<typeof useNavigate>
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className="rounded-lg focus:outline-none"
      >
        <Avatar className="h-8 w-8 rounded-lg bg-primary/10 text-primary">
          <AvatarImage src={image ?? undefined} alt="Profile" />
          <AvatarFallback className="bg-transparent text-primary text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border/40 bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60"
            )}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate("/profile")
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/40"
            >
              <User className="h-4 w-4" /> Profile
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate("/stats")
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/40"
            >
              <MapPin className="h-4 w-4" /> Stats
            </button>
            <div className="my-1 h-px bg-border/40" />
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
