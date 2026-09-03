// routes/community.ts
// Community read + private-messaging API.
//
// Per-place visitor counts (how many REGISTERED users have unlocked a place)
// come straight from unlockedPlaces, which is unique per (placeId, userId), so
// a count is one grouped query. Visitor identities are private: the names/avatars
// list is only returned to a logged-in requester; anon/guest callers get just
// the number.
//
// 1:1 DMs live in three tables (conversations, conversationParticipants,
// messages) and are requireAuth-only — guests never participate. There is no
// realtime transport; clients poll (list + unread every ~10s, an open thread
// every ~5s), mirroring how the app already reads comments.
//
// Response shapes:
//   GET  /community/places/:placeId
//     -> { total, visitors?: [{ userId, firstName, lastName, profileImage,
//          visitedAt, connected, incomingPending, outgoingPending }] }
//                                        (visitors only when logged in)
//   POST /community/conversations  { otherUserId }
//     -> { conversation: ConversationSummary }  (reuses an existing 1:1; 403 if
//                                                not connected to otherUserId)
//   GET  /community/conversations
//     -> { conversations: ConversationSummary[] }
//   GET  /community/conversations/:id/messages?after=<ISO>
//     -> { messages: Message[], withUser: Profile | null }  (does not mark read)
//   POST /community/conversations/:id/read      -> { ok: true }
//   POST /community/conversations/:id/messages  { body } -> { message }  (403 if
//                                                no longer connected to the peer)
//   GET  /community/unread-count                -> { total }
//   GET  /community/co-travelers
//     -> { travelers: FellowTraveler[] }         (registered users sharing >=1
//                                                 unlocked place with me)
//   GET  /community/connections                 -> { connections: Person[] }
//       (my accepted connections — symmetric, so exactly the users I can DM)
//   POST /community/connections { userId }
//     -> { connected: true }  (accepts an incoming request, or already connected)
//     -> { connected: false, pending: true }  (new request sent)
//   POST /community/connections/:userId/accept  -> { connected: true }
//   DELETE /community/connections/:userId       -> { connected: false }
//       (covers decline of an incoming request, cancelling an outgoing one, and
//        disconnecting an accepted friendship — deletes the matching row(s))
//   GET  /community/connections/pending
//     -> { incoming: Person[], outgoing: Person[] }  (open requests)
//   GET  /community/users?q=<>=2 chars          -> { users: SearchResult[] }
//   POST /community/follows  { userId }         -> { following: true }  (one-way
//                                                 subscription; notifies the target)
//   DELETE /community/follows/:userId           -> { following: false }
//
// Connections are a request → accept "friendship": a connection is two
// symmetric rows (A→B and B→A) both `status = 'accepted'`; a single `pending`
// row is an open request. Legacy one-way accepted rows were mirrored by a
// migration so every accepted connection is symmetric — which is what makes the
// DM gate ("connected") a single both-rows-accepted check. Relation state
// between me and another user is always the triple { connected,
// incomingPending, outgoingPending } derived from the 1–2 rows.
//
// ConversationSummary = { id, withUser, updatedAt, lastMessage | null,
//                          unreadCount }; Message = { id, conversationId,
//                          authorUserId, body, createdAt }; Profile = { userId,
//                          firstName, lastName, profileImage }.
// FellowTraveler = Person & { sharedPlaces, lastSharedAt };
// Person = Profile & { username, connected, incomingPending, outgoingPending }.
import { Router } from "express"
import {
  eq,
  and,
  or,
  ne,
  gt,
  isNull,
  isNotNull,
  inArray,
  desc,
  asc,
  sql,
  ilike,
  type SQL,
} from "drizzle-orm"
import { db } from "../db/index.ts"
import {
  users,
  unlockedPlaces,
  conversations,
  conversationParticipants as participants,
  messages,
  connections,
  follows,
  notifications,
} from "../db/schema.ts"
import { optionalAuth, requireAuth } from "../middleware/auth.ts"
import { notify } from "../lib/notify.ts"

const router = Router()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Express 5 types route params as string | string[]; coerce + narrow to a
// single string so UUID checks and drizzle column comparisons stay type-safe.
function paramStr(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

type Profile = {
  userId: string
  firstName: string
  lastName: string
  profileImage: string | null
}

type LastMessage = {
  id: string
  body: string
  authorUserId: string
  createdAt: Date
}

type ConversationSummary = {
  id: string
  withUser: Profile | null
  updatedAt: Date
  lastMessage: LastMessage | null
  unreadCount: number
}

function profileOf(row: {
  userId: string
  firstName: string
  lastName: string
  profileImage: string | null
}): Profile {
  return {
    userId: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    profileImage: row.profileImage,
  }
}

// The OTHER side of a conversation from `me`'s point of view (first non-me
// participant, oldest first). Null only if the thread somehow has no peer.
async function otherParticipantProfile(conversationId: string, me: string): Promise<Profile | null> {
  const rows = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImage: users.profileImage,
    })
    .from(participants)
    .innerJoin(users, eq(participants.userId, users.id))
    .where(
      and(
        eq(participants.conversationId, conversationId),
        ne(participants.userId, me)
      )
    )
    .orderBy(asc(participants.createdAt))
    .limit(1)
  return rows.length ? profileOf(rows[0]) : null
}

async function otherParticipantUserId(conversationId: string, me: string): Promise<string | null> {
  const rows = await db
    .select({ userId: participants.userId })
    .from(participants)
    .where(
      and(eq(participants.conversationId, conversationId), ne(participants.userId, me))
    )
    .orderBy(asc(participants.createdAt))
    .limit(1)
  return rows[0]?.userId ?? null
}

async function isParticipant(conversationId: string, me: string): Promise<boolean> {
  const rows = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(eq(participants.conversationId, conversationId), eq(participants.userId, me))
    )
    .limit(1)
  return rows.length > 0
}

// Unread messages in a conversation for `me`: messages by the OTHER author
// written after my lastReadAt (all of them if I've never read the thread).
async function unreadCountFor(conversationId: string, me: string, lastReadAt: Date | null): Promise<number> {
  const conds: SQL[] = [
    eq(messages.conversationId, conversationId),
    ne(messages.authorUserId, me),
  ]
  if (lastReadAt) conds.push(gt(messages.createdAt, lastReadAt))
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(...conds))
  return rows[0]?.n ?? 0
}

// Full inbox row for one conversation. Returns null when the caller is not a
// participant (used as a guard) or the conversation doesn't exist.
async function loadConversationSummary(conversationId: string, me: string): Promise<ConversationSummary | null> {
  const conv = await db
    .select({ id: conversations.id, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)
  if (conv.length === 0) return null

  const mine = await db
    .select({ lastReadAt: participants.lastReadAt })
    .from(participants)
    .where(
      and(eq(participants.conversationId, conversationId), eq(participants.userId, me))
    )
    .limit(1)
  if (mine.length === 0) return null

  const last = await db
    .select({
      id: messages.id,
      body: messages.body,
      authorUserId: messages.authorUserId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(1)

  return {
    id: conversationId,
    withUser: await otherParticipantProfile(conversationId, me),
    updatedAt: conv[0].updatedAt,
    lastMessage: last.length ? last[0] : null,
    unreadCount: await unreadCountFor(conversationId, me, mine[0].lastReadAt),
  }
}

// ---- Connections (request/accept friendships) + co-traveler discovery helpers ----

type ConnStatus = "pending" | "accepted"

type ConnState = {
  // Status of the row I hold toward each other user (me → them), keyed by id.
  outgoing: Map<string, ConnStatus>
  // Status of the row each other user holds toward me (them → me), keyed by id.
  incoming: Map<string, ConnStatus>
  // The users I follow (one-way subscriptions, from the `follows` table).
  following: Set<string>
}

// The caller's whole social graph in three collections keyed by the OTHER user's
// id. One pass covers the graph for any list-scoped stamping (co-travelers,
// visitors, search, the People tab).
async function loadConnectionState(me: string): Promise<ConnState> {
  const [rows, followRows] = await Promise.all([
    db
      .select({
        followerId: connections.followerId,
        followeeId: connections.followeeId,
        status: connections.status,
      })
      .from(connections)
      .where(or(eq(connections.followerId, me), eq(connections.followeeId, me))),
    db
      .select({ followeeId: follows.followeeId })
      .from(follows)
      .where(eq(follows.followerId, me)),
  ])
  const outgoing = new Map<string, ConnStatus>()
  const incoming = new Map<string, ConnStatus>()
  for (const r of rows) {
    if (r.followerId === me) outgoing.set(r.followeeId, r.status)
    else incoming.set(r.followerId, r.status)
  }
  return { outgoing, incoming, following: new Set(followRows.map((r) => r.followeeId)) }
}

// The relation for one other user. `connected` is ONLY both directions
// accepted — that is the state that unlocks DMs. `following` is my one-way
// subscription to their public pins/routes.
function relationOf(state: ConnState, userId: string) {
  const out = state.outgoing.get(userId)
  const inc = state.incoming.get(userId)
  return {
    connected: out === "accepted" && inc === "accepted",
    outgoingPending: out === "pending",
    incomingPending: inc === "pending",
    following: state.following.has(userId),
  }
}

// The 1–2 rows between me and one other user (my row toward them, their row
// toward me) — used by the connect/accept/decline writes and the DM gate.
async function pairRowsBetween(
  me: string,
  other: string
): Promise<{
  mine: { id: string; status: ConnStatus } | null
  theirs: { id: string; status: ConnStatus } | null
}> {
  const [mine, theirs] = await Promise.all([
    db
      .select({ id: connections.id, status: connections.status })
      .from(connections)
      .where(and(eq(connections.followerId, me), eq(connections.followeeId, other)))
      .limit(1),
    db
      .select({ id: connections.id, status: connections.status })
      .from(connections)
      .where(and(eq(connections.followerId, other), eq(connections.followeeId, me)))
      .limit(1),
  ])
  return { mine: mine[0] ?? null, theirs: theirs[0] ?? null }
}

// True when `me` and `other` have accepted each other (the DM prerequisite).
async function areConnected(me: string, other: string): Promise<boolean> {
  const { mine, theirs } = await pairRowsBetween(me, other)
  return mine?.status === "accepted" && theirs?.status === "accepted"
}

// True when `me` follows `other` (one-way subscription to their public content).
async function isFollowing(me: string, other: string): Promise<boolean> {
  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, me), eq(follows.followeeId, other)))
    .limit(1)
  return rows.length > 0
}

// Every user id that `me` follows — the audience for my own public pins/routes
// is my accepted connections + my followers, but what *I* can see of other
// people's public content is the reverse: users I'm connected to or follow.
async function myFollowIds(me: string): Promise<string[]> {
  const rows = await db
    .select({ followeeId: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, me))
  return rows.map((r) => r.followeeId)
}

// Accept an open request that `them` sent to `me`: flip their row to accepted
// and insert/upgrade my mirror row to accepted. Emits the connection_accepted
// notification to the original requester and clears my open request note (the
// request is resolved, so it must leave my bell).
async function acceptRequest(me: string, them: string): Promise<void> {
  const theirs = await db
    .select({ id: connections.id })
    .from(connections)
    .where(and(eq(connections.followerId, them), eq(connections.followeeId, me)))
    .limit(1)
  if (theirs.length === 0) return
  await db
    .update(connections)
    .set({ status: "accepted" })
    .where(eq(connections.id, theirs[0].id))
  await db
    .insert(connections)
    .values({ followerId: me, followeeId: them, status: "accepted" })
    .onConflictDoUpdate({
      // Upgrade a mirror request I'd already sent them (rare simultaneous-ask)
      // to accepted rather than erroring on the unique (follower, followee).
      target: [connections.followerId, connections.followeeId],
      set: { status: "accepted" },
    })
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, me),
        eq(notifications.actorUserId, them),
        eq(notifications.type, "connection_request")
      )
    )
  await notify({
    recipientUserId: them,
    actorUserId: me,
    type: "connection_accepted",
  })
}

// Mark every open `message` notification for me in a conversation as read — the
// /read route calls this so a thread the user has opened stops re-toasting.
async function clearMessageNotifications(conversationId: string, me: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientUserId, me),
        eq(notifications.type, "message"),
        eq(notifications.refId, conversationId),
        isNull(notifications.readAt)
      )
    )
}

// The set of place ids I've unlocked (registered, non-null user only).
async function myVisitedPlaceIds(me: string): Promise<string[]> {
  const rows = await db
    .select({ placeId: unlockedPlaces.placeId })
    .from(unlockedPlaces)
    .where(and(eq(unlockedPlaces.userId, me), isNotNull(unlockedPlaces.placeId)))
  return rows.map((r) => r.placeId!).filter(Boolean)
}

// For a list of OTHER users, how many of MY unlocked places they share (count
// of distinct (user, place) rows where the place is in my set — valid because
// unlockedPlaces is unique per (placeId, userId)) and when they last unlocked
// one of them. Empty map when either side is empty.
async function sharedPlaceCountsByUser(
  userIds: string[],
  myPlaceIds: string[],
  me: string
): Promise<Map<string, { sharedPlaces: number; lastSharedAt: Date | null }>> {
  const out = new Map<string, { sharedPlaces: number; lastSharedAt: Date | null }>()
  if (userIds.length === 0 || myPlaceIds.length === 0) return out
  const rows = await db
    .select({
      userId: unlockedPlaces.userId,
      sharedPlaces: sql<number>`count(*)::int`,
      lastSharedAt: sql<Date | null>`max(${unlockedPlaces.unlockedAt})`,
    })
    .from(unlockedPlaces)
    .where(
      and(
        inArray(unlockedPlaces.placeId, myPlaceIds),
        inArray(unlockedPlaces.userId, userIds),
        ne(unlockedPlaces.userId, me),
        isNotNull(unlockedPlaces.userId)
      )
    )
    .groupBy(unlockedPlaces.userId)
  for (const r of rows) {
    if (r.userId) {
      out.set(r.userId, { sharedPlaces: r.sharedPlaces, lastSharedAt: r.lastSharedAt })
    }
  }
  return out
}

// LIKE input sanitation: `_` and `%` are wildcards in the caller's query string
// and would otherwise let a username search act as a broad wildcard match.
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

// ---- Per-place visitor counts ----

router.get("/places/:placeId", optionalAuth, async (req, res) => {
  try {
    const placeId = paramStr(req.params.placeId)
    if (!placeId) {
      return res.status(400).json({ error: "Invalid place id" })
    }
    const totalRows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(unlockedPlaces)
      .where(and(eq(unlockedPlaces.placeId, placeId), isNotNull(unlockedPlaces.userId)))

    const payload: { total: number; visitors?: Profile[] } = {
      total: totalRows[0]?.n ?? 0,
    }

    // Identities only for a real, logged-in caller.
    if (req.userId) {
      const rows = await db
        .select({
          userId: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImage: users.profileImage,
          visitedAt: unlockedPlaces.unlockedAt,
        })
        .from(unlockedPlaces)
        .innerJoin(users, eq(unlockedPlaces.userId, users.id))
        .where(
          and(eq(unlockedPlaces.placeId, placeId), ne(unlockedPlaces.userId, req.userId))
        )
        .orderBy(desc(unlockedPlaces.unlockedAt))
        .limit(20)
      const state = await loadConnectionState(req.userId)
      payload.visitors = rows.map((r) => ({
        ...profileOf(r),
        visitedAt: r.visitedAt,
        ...relationOf(state, r.userId),
      }))
    }

    res.json(payload)
  } catch (err) {
    console.error("Failed to load place visitors:", err)
    res.status(500).json({ error: "Failed to load place visitors" })
  }
})

// ---- Follows (one-way subscriptions) ----

// Follow another registered user — instant, no accept. Following someone is how
// you subscribe to their public pins/routes. Idempotent: following someone you
// already follow is a no-op (no duplicate notification).
router.post("/follows", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const target: unknown = req.body?.userId
    if (typeof target !== "string" || !UUID_RE.test(target)) {
      return res.status(400).json({ error: "Invalid user id" })
    }
    if (target === me) {
      return res.status(400).json({ error: "You can't follow yourself" })
    }
    const existing = await db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.followerId, me), eq(follows.followeeId, target)))
      .limit(1)
    if (existing.length === 0) {
      const inserted = await db
        .insert(follows)
        .values({ followerId: me, followeeId: target })
        .onConflictDoNothing()
        .returning()
      if (inserted.length > 0) {
        await notify({
          recipientUserId: target,
          actorUserId: me,
          type: "follow",
        })
      }
    }
    res.json({ following: true })
  } catch (err) {
    console.error("Failed to follow user:", err)
    res.status(500).json({ error: "Failed to follow user" })
  }
})

// Unfollow. State-agnostic — works whether or not the row exists.
router.delete("/follows/:userId", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const target = paramStr(req.params.userId)
    if (!target || !UUID_RE.test(target)) {
      return res.status(400).json({ error: "Invalid user id" })
    }
    await db
      .delete(follows)
      .where(and(eq(follows.followerId, me), eq(follows.followeeId, target)))
    res.json({ following: false })
  } catch (err) {
    console.error("Failed to unfollow user:", err)
    res.status(500).json({ error: "Failed to unfollow user" })
  }
})

// ---- Conversations ----

// Open (or reuse) a 1:1 conversation with another registered user.
router.post("/conversations", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const other: unknown = req.body?.otherUserId
    if (typeof other !== "string" || !UUID_RE.test(other)) {
      return res.status(400).json({ error: "Invalid user id" })
    }
    if (other === me) {
      return res.status(400).json({ error: "You can't message yourself" })
    }
    const existing = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, other))
      .limit(1)
    if (existing.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    // DM gate: you can only message someone you've mutually accepted. Guests
    // never reach here (requireAuth); this is the registered-user equivalent.
    if (!(await areConnected(me, other))) {
      const name = `${existing[0].firstName} ${existing[0].lastName}`.trim()
      return res.status(403).json({
        error: `Connect with ${name} first to send messages`,
      })
    }

    // Reuse an existing thread where both of us are participants.
    const mine = await db
      .select({ conversationId: participants.conversationId })
      .from(participants)
      .where(eq(participants.userId, me))
    let conversationId: string | null = null
    if (mine.length > 0) {
      const theirs = await db
        .select({ conversationId: participants.conversationId })
        .from(participants)
        .where(
          and(
            inArray(
              participants.conversationId,
              mine.map((m) => m.conversationId)
            ),
            eq(participants.userId, other)
          )
        )
        .limit(1)
      conversationId = theirs[0]?.conversationId ?? null
    }

    if (!conversationId) {
      const created = await db
        .insert(conversations)
        .values({})
        .returning({ id: conversations.id })
      conversationId = created[0].id
      await db.insert(participants).values([
        { conversationId, userId: me },
        { conversationId, userId: other },
      ])
    }

    const summary = await loadConversationSummary(conversationId, me)
    res.json({ conversation: summary })
  } catch (err) {
    console.error("Failed to open conversation:", err)
    res.status(500).json({ error: "Failed to open conversation" })
  }
})

// Inbox: every conversation the caller is in, most recently active first.
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const mine = await db
      .select({ conversationId: participants.conversationId })
      .from(participants)
      .where(eq(participants.userId, me))

    const summaries = await Promise.all(
      mine.map((m) => loadConversationSummary(m.conversationId, me))
    )
    const conversationsOut = summaries.filter(
      (s): s is ConversationSummary => s !== null
    )
    conversationsOut.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    res.json({ conversations: conversationsOut })
  } catch (err) {
    console.error("Failed to load conversations:", err)
    res.status(500).json({ error: "Failed to load conversations" })
  }
})

// Unread badge for the nav. Polled by the frontend while the app is open.
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const mine = await db
      .select({ conversationId: participants.conversationId, lastReadAt: participants.lastReadAt })
      .from(participants)
      .where(eq(participants.userId, me))

    let total = 0
    for (const m of mine) {
      total += await unreadCountFor(m.conversationId, me, m.lastReadAt)
    }
    res.json({ total })
  } catch (err) {
    console.error("Failed to count unread:", err)
    res.status(500).json({ error: "Failed to count unread" })
  }
})

// ---- Co-travelers, connections, and username search ----
// A "co-traveler" is any registered user who has unlocked at least one place I
// have also unlocked. Discovery reads straight off unlockedPlaces (unique per
// (placeId, userId)), so counting shared places is a group-by-user query.

// Travelers I've crossed paths with: people sharing >=1 of my places, most
// places in common first (ties by their most recent shared visit).
router.get("/co-travelers", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const myPlaceIds = await myVisitedPlaceIds(me)
    if (myPlaceIds.length === 0) {
      return res.json({ travelers: [] })
    }

    const rows = await db
      .select({
        userId: unlockedPlaces.userId,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImage: users.profileImage,
        sharedPlaces: sql<number>`count(*)::int`,
        lastSharedAt: sql<Date | null>`max(${unlockedPlaces.unlockedAt})`,
      })
      .from(unlockedPlaces)
      .innerJoin(users, eq(unlockedPlaces.userId, users.id))
      .where(
        and(
          inArray(unlockedPlaces.placeId, myPlaceIds),
          ne(unlockedPlaces.userId, me),
          isNotNull(unlockedPlaces.userId)
        )
      )
      .groupBy(
        unlockedPlaces.userId,
        users.username,
        users.firstName,
        users.lastName,
        users.profileImage
      )
      .orderBy(desc(sql`count(*)`), desc(sql`max(${unlockedPlaces.unlockedAt})`))
      .limit(20)

    const state = await loadConnectionState(me)
    res.json({
      travelers: rows.map((r) => ({
        userId: r.userId!,
        username: r.username,
        firstName: r.firstName,
        lastName: r.lastName,
        profileImage: r.profileImage,
        sharedPlaces: r.sharedPlaces,
        lastSharedAt: r.lastSharedAt,
        ...relationOf(state, r.userId!),
      })),
    })
  } catch (err) {
    console.error("Failed to load co-travelers:", err)
    res.status(500).json({ error: "Failed to load co-travelers" })
  }
})

// Everyone I'm connected to (accepted both ways), most recent connection first,
// each with a shared-place count against my own unlocks (0 when we've never
// overlapped). Because accepted connections are symmetric, this set is exactly
// the users I can DM — the People tab.
router.get("/connections", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const followRows = await db
      .select({ followeeId: connections.followeeId, createdAt: connections.createdAt })
      .from(connections)
      .where(and(eq(connections.followerId, me), eq(connections.status, "accepted")))
      .orderBy(desc(connections.createdAt))
    const followeeIds = followRows.map((r) => r.followeeId)
    if (followeeIds.length === 0) {
      return res.json({ connections: [] })
    }

    const [profiles, counts] = await Promise.all([
      db
        .select({
          userId: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImage: users.profileImage,
        })
        .from(users)
        .where(inArray(users.id, followeeIds)),
      sharedPlaceCountsByUser(followeeIds, await myVisitedPlaceIds(me), me),
    ])
    const profileById = new Map(profiles.map((p) => [p.userId, p]))

    const list = followRows
      .map((fr) => {
        const u = profileById.get(fr.followeeId)
        if (!u) return null
        const shared = counts.get(fr.followeeId)
        return {
          userId: u.userId,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          profileImage: u.profileImage,
          sharedPlaces: shared?.sharedPlaces ?? 0,
          connected: true,
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)

    res.json({ connections: list })
  } catch (err) {
    console.error("Failed to load connections:", err)
    res.status(500).json({ error: "Failed to load connections" })
  }
})

// Open connection requests: who wants to connect with me (incoming) and who I've
// asked but they haven't answered yet (outgoing). Drives the People tab's
// Requests section and the request-sent state.
router.get("/connections/pending", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const [incomingRows, outgoingRows] = await Promise.all([
      db
        .select({ followerId: connections.followerId, createdAt: connections.createdAt })
        .from(connections)
        .where(and(eq(connections.followeeId, me), eq(connections.status, "pending")))
        .orderBy(desc(connections.createdAt)),
      db
        .select({ followeeId: connections.followeeId, createdAt: connections.createdAt })
        .from(connections)
        .where(and(eq(connections.followerId, me), eq(connections.status, "pending")))
        .orderBy(desc(connections.createdAt)),
    ])

    const incomingIds = incomingRows.map((r) => r.followerId)
    const outgoingIds = outgoingRows.map((r) => r.followeeId)
    const [incomingProfiles, outgoingProfiles] = await Promise.all([
      incomingIds.length
        ? db
            .select({
              userId: users.id,
              username: users.username,
              firstName: users.firstName,
              lastName: users.lastName,
              profileImage: users.profileImage,
            })
            .from(users)
            .where(inArray(users.id, incomingIds))
        : Promise.resolve([]),
      outgoingIds.length
        ? db
            .select({
              userId: users.id,
              username: users.username,
              firstName: users.firstName,
              lastName: users.lastName,
              profileImage: users.profileImage,
            })
            .from(users)
            .where(inArray(users.id, outgoingIds))
        : Promise.resolve([]),
    ])
    const incomingById = new Map(incomingProfiles.map((p) => [p.userId, p]))
    const outgoingById = new Map(outgoingProfiles.map((p) => [p.userId, p]))

    res.json({
      incoming: incomingRows
        .map((r) => incomingById.get(r.followerId))
        .filter((u): u is NonNullable<typeof u> => u !== undefined)
        .map((u) => ({ ...u, connected: false, incomingPending: true, outgoingPending: false })),
      outgoing: outgoingRows
        .map((r) => outgoingById.get(r.followeeId))
        .filter((u): u is NonNullable<typeof u> => u !== undefined)
        .map((u) => ({ ...u, connected: false, incomingPending: false, outgoingPending: true })),
    })
  } catch (err) {
    console.error("Failed to load pending connections:", err)
    res.status(500).json({ error: "Failed to load pending connections" })
  }
})

// Connect with another user — or, when they've already requested me, accept
// them. Idempotent: repeating an existing state is a no-op, so the UI can call
// it freely. Emits the matching notification (connection_request when I ask,
// connection_accepted when my tap accepts their open request).
router.post("/connections", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const target: unknown = req.body?.userId
    if (typeof target !== "string" || !UUID_RE.test(target)) {
      return res.status(400).json({ error: "Invalid user id" })
    }
    if (target === me) {
      return res.status(400).json({ error: "You can't connect with yourself" })
    }
    const found = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, target))
      .limit(1)
    if (found.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    const { mine, theirs } = await pairRowsBetween(me, target)

    // Already friends both ways — nothing to do.
    if (mine?.status === "accepted" && theirs?.status === "accepted") {
      return res.json({ connected: true })
    }

    // They already asked me — this tap accepts their request (mirror inserted).
    if (theirs?.status === "pending") {
      await acceptRequest(me, target)
      return res.json({ connected: true })
    }

    // Otherwise send a request. Notify only when a genuinely NEW request row is
    // created — sending over my own still-open pending row (the unique index
    // makes the insert a no-op) must not stack a duplicate "wants to connect"
    // popup on the other side.
    if (mine?.status !== "pending") {
      await db
        .insert(connections)
        .values({ followerId: me, followeeId: target, status: "pending" })
        .onConflictDoNothing()
      await notify({ recipientUserId: target, actorUserId: me, type: "connection_request" })
    }
    res.status(201).json({ connected: false, pending: true })
  } catch (err) {
    console.error("Failed to connect with user:", err)
    res.status(500).json({ error: "Failed to connect with user" })
  }
})

// Explicit accept of an incoming request (from the bell or the Requests
// section). 404 when there's nothing to accept.
router.post("/connections/:userId/accept", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const target = paramStr(req.params.userId)
    if (!target || !UUID_RE.test(target)) {
      return res.status(400).json({ error: "Invalid user id" })
    }
    const { theirs } = await pairRowsBetween(me, target)
    if (!theirs || theirs.status !== "pending") {
      return res.status(404).json({ error: "No connection request to accept" })
    }
    await acceptRequest(me, target)
    res.json({ connected: true })
  } catch (err) {
    console.error("Failed to accept connection:", err)
    res.status(500).json({ error: "Failed to accept connection" })
  }
})

// Remove the connection in whatever state it's in: incoming request → decline
// (deletes their row), outgoing request → cancel (deletes mine), accepted →
// disconnect (deletes both). Deleting rows that don't exist is a no-op.
// Decline/cancel also clear the open connection_request notification so the
// recipient's bell doesn't keep advertising a request that can no longer be
// accepted.
router.delete("/connections/:userId", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const target = paramStr(req.params.userId)
    if (!target || !UUID_RE.test(target)) {
      return res.status(400).json({ error: "Invalid user id" })
    }
    const { mine, theirs } = await pairRowsBetween(me, target)

    await db
      .delete(connections)
      .where(
        and(
          or(
            and(eq(connections.followerId, me), eq(connections.followeeId, target)),
            and(eq(connections.followerId, target), eq(connections.followeeId, me))
          )
        )
      )

    if (theirs?.status === "pending") {
      // Decline of THEIR request to me → remove the "they want to connect" note.
      await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.recipientUserId, me),
            eq(notifications.actorUserId, target),
            eq(notifications.type, "connection_request")
          )
        )
    } else if (mine?.status === "pending") {
      // Cancel of MY request to them → remove their "…wants to connect" note.
      await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.recipientUserId, target),
            eq(notifications.actorUserId, me),
            eq(notifications.type, "connection_request")
          )
        )
    }

    res.json({ connected: false })
  } catch (err) {
    console.error("Failed to remove connection:", err)
    res.status(500).json({ error: "Failed to remove connection" })
  }
})

// Username/name search powering the Messages tab's "find any traveler" box.
// requireAuth only — guests can't enumerate users. LIKE terms are escaped so a
// `%` or `_` in the query can't widen into a wildcard match.
router.get("/users", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
    if (q.length < 2) {
      return res.status(400).json({ error: "Search needs at least 2 characters" })
    }
    const pattern = `%${escapeLike(q)}%`
    const rows = await db
      .select({
        userId: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImage: users.profileImage,
      })
      .from(users)
      .where(
        and(
          ne(users.id, me),
          or(
            ilike(users.username, pattern),
            ilike(users.firstName, pattern),
            ilike(users.lastName, pattern)
          )
        )
      )
      .limit(10)

    const state = await loadConnectionState(me)
    res.json({
      users: rows.map((u) => ({
        userId: u.userId,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        profileImage: u.profileImage,
        ...relationOf(state, u.userId),
      })),
    })
  } catch (err) {
    console.error("Failed to search users:", err)
    res.status(500).json({ error: "Failed to search users" })
  }
})

// ---- Messages ----

// A thread's messages, oldest first. `after` returns only newer messages for
// lightweight polling. Never marks anything read — the client calls /read.
router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const id = paramStr(req.params.id)
    if (!id) {
      return res.status(400).json({ error: "Invalid conversation id" })
    }
    if (!(await isParticipant(id, me))) {
      return res.status(403).json({ error: "Not a participant" })
    }

    const conds: SQL[] = [eq(messages.conversationId, id)]
    const after = typeof req.query.after === "string" ? new Date(req.query.after) : null
    if (after && !Number.isNaN(after.getTime())) {
      conds.push(gt(messages.createdAt, after))
    }

    const rows = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        authorUserId: messages.authorUserId,
        body: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(...conds))
      .orderBy(asc(messages.createdAt))
      .limit(500)

    res.json({
      messages: rows,
      withUser: await otherParticipantProfile(id, me),
    })
  } catch (err) {
    console.error("Failed to load messages:", err)
    res.status(500).json({ error: "Failed to load messages" })
  }
})

// Send a message and mark the thread read for the sender. Requires still being
// connected to the peer (a connection can be severed after the thread opened).
router.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const id = paramStr(req.params.id)
    if (!id) {
      return res.status(400).json({ error: "Invalid conversation id" })
    }
    if (!(await isParticipant(id, me))) {
      return res.status(403).json({ error: "Not a participant" })
    }
    const peerId = await otherParticipantUserId(id, me)
    if (!peerId || !(await areConnected(me, peerId))) {
      return res.status(403).json({
        error: "You're no longer connected to this user — reconnect to keep chatting",
      })
    }

    const body: unknown = req.body?.body
    const text = typeof body === "string" ? body.trim() : ""
    if (!text) {
      return res.status(400).json({ error: "Message can't be empty" })
    }
    if (text.length > 4000) {
      return res.status(400).json({ error: "Message is too long" })
    }

    const created = await db
      .insert(messages)
      .values({ conversationId: id, authorUserId: me, body: text })
      .returning({
        id: messages.id,
        conversationId: messages.conversationId,
        authorUserId: messages.authorUserId,
        body: messages.body,
        createdAt: messages.createdAt,
      })

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, id))
    await db
      .update(participants)
      .set({ lastReadAt: new Date() })
      .where(
        and(eq(participants.conversationId, id), eq(participants.userId, me))
      )

    // The peer's in-app popup for the new message (best-effort).
    await notify({
      recipientUserId: peerId,
      actorUserId: me,
      type: "message",
      refId: id,
      context: text.slice(0, 200),
    })

    res.json({ message: created[0] })
  } catch (err) {
    console.error("Failed to send message:", err)
    res.status(500).json({ error: "Failed to send message" })
  }
})

// Mark a thread read up to now — and clear this conversation's message
// notifications so a just-opened thread stops re-toasting in the bell.
router.post("/conversations/:id/read", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const id = paramStr(req.params.id)
    if (!id) {
      return res.status(400).json({ error: "Invalid conversation id" })
    }
    if (!(await isParticipant(id, me))) {
      return res.status(403).json({ error: "Not a participant" })
    }
    await db
      .update(participants)
      .set({ lastReadAt: new Date() })
      .where(
        and(eq(participants.conversationId, id), eq(participants.userId, me))
      )
    await clearMessageNotifications(id, me)
    res.json({ ok: true })
  } catch (err) {
    console.error("Failed to mark read:", err)
    res.status(500).json({ error: "Failed to mark read" })
  }
})

// ---- Shared social-graph helpers ----
// Imported by pins.ts (public feed), comments.ts (target gating), user.ts
// (public profile) and groups.ts. Kept here as the single source of truth for
// how connection + follow rows translate into visibility.

export { areConnected, pairRowsBetween, isFollowing, myFollowIds }

// Can `viewer` see/comment the content owned by `owner`? The owner always can;
// otherwise the viewer must be an accepted connection or follow the owner.
export async function canViewOwner(viewer: string, owner: string): Promise<boolean> {
  if (viewer === owner) return true
  return (await areConnected(viewer, owner)) || (await isFollowing(viewer, owner))
}

// The user ids whose public content `me` may see: accepted connections (either
// direction — symmetric after the backfill, so effectively mutual) plus the
// users `me` follows. Powers GET /pins/public.
export async function contentAudienceFor(me: string): Promise<string[]> {
  const state = await loadConnectionState(me)
  const set = new Set<string>()
  for (const [id, status] of state.outgoing) if (status === "accepted") set.add(id)
  for (const [id, status] of state.incoming) if (status === "accepted") set.add(id)
  for (const id of state.following) set.add(id)
  return [...set]
}

// The full picture of how `me` and `other` relate (connected / pending flags /
// whether I follow them) plus whether `other` follows me back.
export async function relationTo(me: string, other: string) {
  const state = await loadConnectionState(me)
  const base = relationOf(state, other)
  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, other), eq(follows.followeeId, me)))
    .limit(1)
  return { ...base, followsYou: rows.length > 0 }
}

export default router
