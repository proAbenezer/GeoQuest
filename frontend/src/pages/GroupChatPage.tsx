// pages/GroupChatPage.tsx
// A co-traveler group chat (/messages/groups/:groupId, ProtectedRoute).
// Telegram-style: the creator adds members directly (anyone can leave; only the
// creator adds/removes/deletes), and every member posts freely — unlike 1:1 DMs
// there is no connection gate. Opening the group marks its notifications read;
// a ~5s poll pulls new messages (see useGroups).
import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Check,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  Pencil,
  Search,
  Send,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"
import {
  useGroupThread,
  addGroupMember,
  deleteGroup,
  leaveGroup,
  removeGroupMember,
  updateGroup,
} from "@/hooks/useGroups"
import { searchUsers } from "@/hooks/useConnections"
import GroupProfileFields, {
  type GroupProfileValue,
} from "@/components/groups/GroupProfileFields"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import type { UserSearchResult } from "@/types/community"

function initialsOf(first?: string, last?: string): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?"
}

function clock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

export default function GroupChatPage() {
  const { groupId = "" } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const thread = useGroupThread(groupId || null)

  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Right-side popovers over the thread: add people (creator) / view members.
  const [panel, setPanel] = useState<"add" | "members" | null>(null)
  const [addQuery, setAddQuery] = useState("")
  const [addResults, setAddResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  // Which travelers have been added since the picker opened (for a ✓ state).
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  // Deleting a whole group is destructive — require a confirming second tap.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  // Creator's group-profile editor (name / photo / linked place).
  const [editOpen, setEditOpen] = useState(false)
  const [editValue, setEditValue] = useState<GroupProfileValue | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread.messages.length, groupId])

  // Reset per-group transient state whenever the group changes.
  useEffect(() => {
    setDraft("")
    setSendError(null)
    setPanel(null)
    setAddQuery("")
    setAddResults([])
    setAddedIds(new Set())
    setConfirmingDelete(false)
    setEditOpen(false)
    setEditValue(null)
    setEditError(null)
  }, [groupId])

  // Debounced username/name search inside the "Add people" picker.
  useEffect(() => {
    if (panel !== "add" || addQuery.trim().length < 2) {
      setAddResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      const results = await searchUsers(addQuery)
      setAddResults(results)
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [addQuery, panel])

  const group = thread.group
  const memberIds = new Set(thread.members.map((m) => m.userId))
  const results = addResults.filter((r) => !memberIds.has(r.userId) && r.userId !== user?.id)
  const myId = user?.id

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
    else setSendError("Couldn't send the message — try again.")
  }

  const addPeople = async (userId: string) => {
    const ok = await addGroupMember(groupId, userId)
    if (!ok) return
    setAddedIds((prev) => new Set(prev).add(userId))
    await thread.refresh()
    setAddQuery("")
    setAddResults([])
  }

  const removeMember = async (userId: string) => {
    setRemoving(userId)
    const ok = await removeGroupMember(groupId, userId)
    setRemoving(null)
    if (ok) await thread.refresh()
  }

  const handleLeave = async () => {
    if (leaving || !groupId) return
    setLeaving(true)
    const ok = await leaveGroup(groupId)
    setLeaving(false)
    if (ok) navigate("/messages")
  }

  const handleDelete = async () => {
    if (!groupId) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      setTimeout(() => setConfirmingDelete(false), 3000)
      return
    }
    setConfirmingDelete(false)
    const ok = await deleteGroup(groupId)
    if (ok) navigate("/messages")
  }

  const openEdit = () => {
    if (!group) return
    setEditValue({
      name: group.name,
      imageUrl: group.imageUrl,
      pin: thread.pin,
    })
    setEditError(null)
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editValue || editSaving || !groupId) return
    if (!editValue.name.trim()) return setEditError("Give the group a name")
    setEditSaving(true)
    setEditError(null)
    const ok = await updateGroup(groupId, {
      name: editValue.name.trim(),
      imageUrl: editValue.imageUrl,
      pinId: editValue.pin?.id ?? null,
    })
    setEditSaving(false)
    if (!ok) {
      setEditError("Couldn't save the changes — try again.")
      return
    }
    setEditOpen(false)
    setEditValue(null)
    await thread.refresh()
  }

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : "GQ"

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ---- Top bar ---- */}
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
        <h1 className="text-sm font-semibold text-foreground">Group chat</h1>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/messages"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Messages</span>
          </Link>
          <NotificationBell />
          <Avatar className="h-8 w-8 cursor-pointer rounded-lg bg-primary/10 text-primary shadow-sm transition-all hover:bg-primary/20">
            <AvatarImage src={user?.profileImage} alt={user?.username ?? "Profile"} />
            <AvatarFallback className="bg-transparent text-primary text-xs font-medium">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {!group && thread.loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !group && thread.forbidden ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Users className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">You're not in this group</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            You may have left or been removed. Your other chats are in Messages.
          </p>
          <Button onClick={() => navigate("/messages")}>Back to Messages</Button>
        </div>
      ) : group ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* ---- Group header ---- */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border/40 px-4 py-3">
            <Avatar className="h-9 w-9 shrink-0 rounded-full bg-muted text-xs text-muted-foreground">
              <AvatarImage
                src={group.imageUrl ?? group.createdBy?.profileImage ?? undefined}
                alt={group.name}
              />
              <AvatarFallback className="bg-transparent">
                <Users className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                {group.createdByUserId === myId
                  ? " · you created this group"
                  : group.createdBy
                    ? ` · created by ${group.createdBy.firstName}`
                    : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {group.mine && (
                <Button variant="ghost" size="sm" className="gap-1" onClick={openEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              )}
              {group.mine && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setPanel(panel === "add" ? null : "add")}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add people</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className={cn("gap-1", panel === "members" && "bg-muted text-foreground")}
                onClick={() => setPanel(panel === "members" ? null : "members")}
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Members</span>
              </Button>
              <Button variant="ghost" size="sm" className="gap-1" onClick={handleLeave} disabled={leaving}>
                {leaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Leave</span>
              </Button>
              {group.mine && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className={cn(
                    "gap-1 text-muted-foreground hover:text-destructive",
                    confirmingDelete && "text-destructive"
                  )}
                >
                  {confirmingDelete ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{confirmingDelete ? "Confirm delete" : "Delete"}</span>
                </Button>
              )}
            </div>
          </div>

          {/* ---- Linked place (the pin the group is about) ---- */}
          {thread.pin && (
            <div className="flex items-center gap-2.5 border-b border-border/40 bg-primary/[0.04] px-4 py-2">
              {thread.pin.imageUrl ? (
                <img
                  src={thread.pin.imageUrl}
                  alt={thread.pin.name}
                  className="h-8 w-8 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {thread.pin.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Linked place · shared with this group
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1"
                onClick={() => navigate(`/?pin=${thread.pin.id}`)}
              >
                <MapPin className="h-3.5 w-3.5" />
                View on map
              </Button>
            </div>
          )}

          {/* ---- Members / add-people popover ---- */}
          {panel && (
            <div className="border-b border-border/40 bg-muted/20">
              {panel === "members" ? (
                <ul className="divide-y divide-border/30">
                  {thread.members.map((m) => (
                    <li key={m.userId} className="flex items-center gap-2.5 px-4 py-2">
                      <Link
                        to={`/users/${m.userId}`}
                        onClick={() => setPanel(null)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg hover:bg-muted/40"
                      >
                        <Avatar className="h-8 w-8 rounded-full bg-muted text-[11px] text-muted-foreground">
                          <AvatarImage src={m.profileImage ?? undefined} alt={`${m.firstName} ${m.lastName}`} />
                          <AvatarFallback className="bg-transparent">
                            {initialsOf(m.firstName, m.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {m.firstName} {m.lastName}
                            {m.userId === myId ? " (you)" : ""}
                            {m.userId === group.createdByUserId ? " · creator" : ""}
                          </span>
                        </span>
                      </Link>
                      {group.mine && m.userId !== myId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={removing === m.userId}
                          onClick={() => void removeMember(m.userId)}
                          className="gap-1 text-muted-foreground hover:text-destructive"
                        >
                          {removing === m.userId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                          Remove
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-2 px-4 py-3">
                  <div className="relative">
                    <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                    <input
                      value={addQuery}
                      onChange={(e) => setAddQuery(e.target.value)}
                      placeholder="Search travelers to add…"
                      className="w-full rounded-lg border border-border/40 bg-card/60 py-1.5 pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
                    />
                    {addQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAddQuery("")
                          setAddResults([])
                        }}
                        aria-label="Clear search"
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  {addQuery.trim().length < 2 ? (
                    <p className="px-1 text-xs text-muted-foreground/70">
                      Add any registered traveler directly — no connection needed.
                    </p>
                  ) : searching && results.length === 0 ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : results.length === 0 ? (
                    <p className="px-1 text-sm text-muted-foreground">
                      No travelers match “{addQuery.trim()}”.
                    </p>
                  ) : (
                    <ul className="max-h-56 divide-y divide-border/30 overflow-y-auto">
                      {results.map((r) => (
                        <li key={r.userId} className="flex items-center gap-2.5 py-1.5">
                          <Avatar className="h-8 w-8 rounded-full bg-muted text-[11px] text-muted-foreground">
                            <AvatarImage src={r.profileImage ?? undefined} alt={`${r.firstName} ${r.lastName}`} />
                            <AvatarFallback className="bg-transparent">
                              {initialsOf(r.firstName, r.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {r.firstName} {r.lastName}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">@{r.username}</p>
                          </div>
                          {addedIds.has(r.userId) ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                              <Check className="h-3.5 w-3.5" /> Added
                            </span>
                          ) : (
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => void addPeople(r.userId)}>
                              <UserPlus className="h-3.5 w-3.5" />
                              Add
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ---- Messages ---- */}
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {thread.messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <MessageCircle className="h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">
                  No messages yet — start the conversation.
                </p>
              </div>
            ) : (
              thread.messages.map((m) => {
                const mine = m.authorUserId === myId
                const name = `${m.author.firstName} ${m.author.lastName}`.trim()
                return (
                  <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                    {!mine && (
                      <span className="mb-0.5 px-1 text-[10px] font-medium text-muted-foreground">
                        {name}
                      </span>
                    )}
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

          {/* ---- Composer ---- */}
          {sendError && (
            <p className="border-t border-border/40 px-4 pt-2 text-xs text-destructive">{sendError}</p>
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
              placeholder={`Message ${group.name}…`}
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

          {/* ---- Edit group profile (creator: name / photo / linked place) ---- */}
          {editOpen && editValue && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
              onClick={() => !editSaving && setEditOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border/40 bg-background shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Users className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Edit group</h2>
                      <p className="text-[11px] text-muted-foreground">
                        Only the creator can change the group's profile.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    disabled={editSaving}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <GroupProfileFields value={editValue} onChange={setEditValue} />
                </div>

                {editError && (
                  <p className="border-t border-border/40 px-4 pt-2 text-xs text-destructive">
                    {editError}
                  </p>
                )}

                <div className="flex justify-end gap-2 border-t border-border/40 px-4 py-3">
                  <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void saveEdit()}
                    disabled={editSaving || !editValue.name.trim()}
                    className="gap-1.5"
                  >
                    {editSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {editSaving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
