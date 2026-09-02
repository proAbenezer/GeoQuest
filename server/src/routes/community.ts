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
//          visitedAt, connected }] }            (visitors only when logged in;
//                                                connected = I follow them)
//   POST /community/conversations  { otherUserId }
//     -> { conversation: ConversationSummary }  (reuses an existing 1:1)
//   GET  /community/conversations
//     -> { conversations: ConversationSummary[] }
//   GET  /community/conversations/:id/messages?after=<ISO>
//     -> { messages: Message[], withUser: Profile | null }  (does not mark read)
//   POST /community/conversations/:id/read      -> { ok: true }
//   POST /community/conversations/:id/messages  { body } -> { message }
//   GET  /community/unread-count                -> { total }
//   GET  /community/co-travelers
//     -> { travelers: FellowTraveler[] }         (registered users sharing >=1
//                                                 unlocked place with me)
//   GET  /community/connections                 -> { connections: Person[] }
//   POST /community/connections { userId }      -> { connected: true, user }
//   DELETE /community/connections/:userId       -> { connected: false }
//   GET  /community/users?q=<>=2 chars          -> { users: SearchResult[] }
//
// ConversationSummary = { id, withUser, updatedAt, lastMessage | null,
//                          unreadCount }; Message = { id, conversationId,
//                          authorUserId, body, createdAt }; Profile = { userId,
//                          firstName, lastName, profileImage }.
// FellowTraveler = Person & { sharedPlaces, lastSharedAt, followsMe };
// Person = Profile & { username, connected }.
import { Router } from "express"
import {
  eq,
  and,
  or,
  ne,
  gt,
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
} from "../db/schema.ts"
import { optionalAuth, requireAuth } from "../middleware/auth.ts"

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

// ---- Connections (follows) + co-traveler discovery helpers ----

// The caller's side of the follow graph: everyone I follow and everyone who
// follows me (id sets — enough to stamp `connected` / `followsMe` flags).
async function loadFollowGraph(me: string): Promise<{
  following: Set<string>
  followers: Set<string>
}> {
  const [following, followers] = await Promise.all([
    db
      .select({ userId: connections.followeeId })
      .from(connections)
      .where(eq(connections.followerId, me)),
    db
      .select({ userId: connections.followerId })
      .from(connections)
      .where(eq(connections.followeeId, me)),
  ])
  return {
    following: new Set(following.map((r) => r.userId)),
    followers: new Set(followers.map((r) => r.userId)),
  }
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
      const { following } = await loadFollowGraph(req.userId)
      payload.visitors = rows.map((r) => ({
        ...profileOf(r),
        visitedAt: r.visitedAt,
        connected: following.has(r.userId),
      }))
    }

    res.json(payload)
  } catch (err) {
    console.error("Failed to load place visitors:", err)
    res.status(500).json({ error: "Failed to load place visitors" })
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
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, other))
      .limit(1)
    if (existing.length === 0) {
      return res.status(404).json({ error: "User not found" })
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
// Connections are one-way follows; "connect" means I follow them.

// Travelers I've crossed paths with: people sharing >=1 of my places, most
// places in common first (ties by their most recent shared visit). Follows are
// surfaced as `connected` (I follow them) and `followsMe`.
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

    const { following, followers } = await loadFollowGraph(me)
    res.json({
      travelers: rows.map((r) => ({
        userId: r.userId!,
        username: r.username,
        firstName: r.firstName,
        lastName: r.lastName,
        profileImage: r.profileImage,
        sharedPlaces: r.sharedPlaces,
        lastSharedAt: r.lastSharedAt,
        connected: following.has(r.userId!),
        followsMe: followers.has(r.userId!),
      })),
    })
  } catch (err) {
    console.error("Failed to load co-travelers:", err)
    res.status(500).json({ error: "Failed to load co-travelers" })
  }
})

// Everyone I follow, most recent connection first, each with a shared-place
// count against my own unlocks (0 when we've never overlapped).
router.get("/connections", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const followRows = await db
      .select({ followeeId: connections.followeeId, createdAt: connections.createdAt })
      .from(connections)
      .where(eq(connections.followerId, me))
      .orderBy(desc(connections.createdAt))
    const followeeIds = followRows.map((r) => r.followeeId)
    if (followeeIds.length === 0) {
      return res.json({ connections: [] })
    }

    const [profiles, counts, { followers }] = await Promise.all([
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
      loadFollowGraph(me),
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
          followsMe: followers.has(u.userId),
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)

    res.json({ connections: list })
  } catch (err) {
    console.error("Failed to load connections:", err)
    res.status(500).json({ error: "Failed to load connections" })
  }
})

// Follow another registered user. Idempotent: repeating an existing follow is a
// no-op (unique index + onConflictDoNothing), so the UI can call it freely.
router.post("/connections", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const target: unknown = req.body?.userId
    if (typeof target !== "string" || !UUID_RE.test(target)) {
      return res.status(400).json({ error: "Invalid user id" })
    }
    if (target === me) {
      return res.status(400).json({ error: "You can't follow yourself" })
    }
    const found = await db
      .select({
        userId: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImage: users.profileImage,
      })
      .from(users)
      .where(eq(users.id, target))
      .limit(1)
    if (found.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }
    await db
      .insert(connections)
      .values({ followerId: me, followeeId: target })
      .onConflictDoNothing()
    res.status(201).json({ connected: true, user: found[0] })
  } catch (err) {
    console.error("Failed to follow user:", err)
    res.status(500).json({ error: "Failed to follow user" })
  }
})

// Unfollow. Deleting a follow that doesn't exist is a no-op.
router.delete("/connections/:userId", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const target = paramStr(req.params.userId)
    if (!target || !UUID_RE.test(target)) {
      return res.status(400).json({ error: "Invalid user id" })
    }
    await db
      .delete(connections)
      .where(and(eq(connections.followerId, me), eq(connections.followeeId, target)))
    res.json({ connected: false })
  } catch (err) {
    console.error("Failed to unfollow user:", err)
    res.status(500).json({ error: "Failed to unfollow user" })
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

    const { following } = await loadFollowGraph(me)
    res.json({
      users: rows.map((u) => ({
        userId: u.userId,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        profileImage: u.profileImage,
        connected: following.has(u.userId),
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

// Send a message and mark the thread read for the sender.
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

    res.json({ message: created[0] })
  } catch (err) {
    console.error("Failed to send message:", err)
    res.status(500).json({ error: "Failed to send message" })
  }
})

// Mark a thread read up to now.
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
    res.json({ ok: true })
  } catch (err) {
    console.error("Failed to mark read:", err)
    res.status(500).json({ error: "Failed to mark read" })
  }
})

export default router
