// routes/comments.ts
import { Router } from "express"
import { z } from "zod"
import { eq, and, or, inArray, sql, type SQL } from "drizzle-orm"
import { db } from "../db/index.ts"
import {
  comments,
  commentVotes,
  users,
  pins,
  places,
  follows,
  connections,
} from "../db/schema.ts"
import { optionalAuth, requireAuth } from "../middleware/auth.ts"
import { ensureGuestSession } from "../middleware/guest.ts"
import { notify } from "../lib/notify.ts"
import { canViewOwner } from "./community.ts"

const router = Router()

// ============================================
// TYPES
// ============================================

// The DTO shape returned to the frontend for every comment.
interface CommentDTO {
  id: string
  body: string
  imageUrl: string | null
  parentId: string | null
  createdAt: string
  author: {
    id: string
    firstName: string
    lastName: string
    profileImage: string | null
  }
  netVotes: number
  myVote: 1 | -1 | null
}

type CommentNode = CommentDTO & { replies: CommentNode[] }

// ============================================
// SCHEMAS
// ============================================

const createCommentSchema = z.object({
  body: z.string().min(1, "Comment is required").max(2000, "Comment is too long"),
  imageUrl: z.string().url().max(1000).optional(),
  parentId: z.string().uuid().optional(),
  targetType: z.enum(["pin", "location", "route"]).optional(),
  pinId: z.string().uuid().optional(),
  placeId: z.string().uuid().optional(),
  routeStartPinId: z.string().uuid().optional(),
  routeEndPinId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
})

// ============================================
// MIDDLEWARE
// ============================================

// Comments are readable by everyone (guests included); only logged-in users
// may write or vote. So reads pass through optionalAuth (attaches req.userId
// when a real session exists) and the write/vote/delete routes use requireAuth.
router.use(optionalAuth, ensureGuestSession)

// ============================================
// HELPERS
// ============================================

// Fetches every comment matching `whereClause`, plus its author, net vote
// tally, and (if logged in) the viewer's own vote. Returns flat rows in no
// particular order — callers build the thread or sort for display.
async function fetchComments(
  whereClause: ReturnType<typeof eq>,
  userId?: string
): Promise<CommentDTO[]> {
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      imageUrl: comments.imageUrl,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      authorId: users.id,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorProfileImage: users.profileImage,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorUserId, users.id))
    .where(whereClause)

  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)

  // Net votes: SUM(value) per comment. SUM(int) returns bigint, which the
  // postgres-js driver serializes as a string — cast to int so it stays a number.
  const tallyRows = await db
    .select({
      commentId: commentVotes.commentId,
      netVotes: sql<number>`COALESCE(SUM(${commentVotes.value})::int, 0)`,
    })
    .from(commentVotes)
    .where(inArray(commentVotes.commentId, ids))
    .groupBy(commentVotes.commentId)

  const tallyMap = new Map(tallyRows.map((r) => [r.commentId, r.netVotes]))

  // The viewer's own vote, if logged in.
  const myVoteMap = new Map<string, 1 | -1>()
  if (userId) {
    const myVotes = await db
      .select({ commentId: commentVotes.commentId, value: commentVotes.value })
      .from(commentVotes)
      .where(and(inArray(commentVotes.commentId, ids), eq(commentVotes.userId, userId)))
    for (const v of myVotes) myVoteMap.set(v.commentId, v.value as 1 | -1)
  }

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    imageUrl: r.imageUrl,
    parentId: r.parentId,
    createdAt: new Date(r.createdAt).toISOString(),
    author: {
      id: r.authorId,
      firstName: r.authorFirstName,
      lastName: r.authorLastName,
      profileImage: r.authorProfileImage,
    },
    netVotes: tallyMap.get(r.id) ?? 0,
    myVote: myVoteMap.get(r.id) ?? null,
  }))
}

// Groups flat comments by parentId into a nested thread. Every level is sorted
// by net votes (highest first), ties broken by creation time (earliest first).
function buildThread(flat: CommentDTO[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>()
  for (const c of flat) nodes.set(c.id, { ...c, replies: [] })

  const roots: CommentNode[] = []
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.replies.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortRecursive = (list: CommentNode[]): CommentNode[] => {
    list.sort(
      (a, b) =>
        b.netVotes - a.netVotes ||
        a.createdAt.localeCompare(b.createdAt)
    )
    for (const node of list) node.replies = sortRecursive(node.replies)
    return list
  }

  return sortRecursive(roots)
}

// A registered viewer may read/comment/see content tied to a set of pins
// (a pin target, a route's two endpoint pins, or a reply whose parent targets
// either). Rule: your own pin, or a PUBLIC pin whose owner you're connected to
// or follow. Guests never qualify (no social graph); private foreign pins and
// stranger-owned public pins are both off-limits. Returns a friendly 403 copy.
async function checkPinsViewable(
  viewerId: string | undefined,
  pinIds: Array<string | null | undefined>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = Array.from(new Set(pinIds.filter((id): id is string => Boolean(id))))
  if (ids.length === 0) return { ok: true }
  if (!viewerId) {
    return { ok: false, error: "Sign in to see that" }
  }
  const rows = await db
    .select({ id: pins.id, userId: pins.userId, visibility: pins.visibility })
    .from(pins)
    .where(inArray(pins.id, ids))
  const byId = new Map(rows.map((r) => [r.id, r]))
  for (const id of ids) {
    const pin = byId.get(id)
    if (!pin) return { ok: false, error: "Pin not found" }
    if (pin.userId === viewerId) continue
    if (
      pin.userId &&
      pin.visibility === "public" &&
      (await canViewOwner(viewerId, pin.userId))
    ) {
      continue
    }
    return {
      ok: false,
      error:
        "You can only comment on public pins of travelers you connect with or follow",
    }
  }
  return { ok: true }
}

// Fans out a "new comment" activity to the comment author's followers — the
// one-way audience follow grants — gated so each recipient can actually SEE the
// thread's target (followers only care about content they can view). Follow is
// not mutual, so this deliberately does NOT reach plain connections unless they
// also follow the author. Best-effort: notify() swallows its own errors and the
// caller already committed the comment, so nothing here can fail the write.
//
// Visibility per target:
//   - location  -> community-open, every follower sees it.
//   - pin/route -> a follower must be able to view every endpoint pin (the pin
//                  is theirs, or it's public AND they connect-or-follow the
//                  owner). The author's own private pins therefore never fire.
// refId is the pin the comment is about (a route's start pin) so the app can
// deep-link to the map; location comments have no pin to focus, so refId is null.
async function notifyCommentFollowers(created: {
  authorUserId: string | null
  body: string
  targetType: string | null
  pinId: string | null
  routeStartPinId: string | null
  routeEndPinId: string | null
}) {
  const authorId = created.authorUserId
  if (!authorId) return

  const followerRows = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(eq(follows.followeeId, authorId))
  if (followerRows.length === 0) return
  const qualified = new Set(followerRows.map((r) => r.followerId))
  qualified.delete(authorId) // an author can't follow themselves, but stay safe

  // Which endpoint pin(s) the comment sits on.
  let pinIds: string[] = []
  if (created.targetType === "pin" && created.pinId) {
    pinIds = [created.pinId]
  } else if (
    created.targetType === "route" &&
    created.routeStartPinId &&
    created.routeEndPinId
  ) {
    pinIds = [created.routeStartPinId, created.routeEndPinId]
  }
  const refId =
    created.targetType === "route" ? created.routeStartPinId : created.pinId

  if (pinIds.length > 0) {
    const rows = await db
      .select({ id: pins.id, userId: pins.userId, visibility: pins.visibility })
      .from(pins)
      .where(inArray(pins.id, pinIds))
    for (const pin of rows) {
      if (qualified.size === 0) return
      const owner = pin.userId
      // Followers who can view THIS pin: its owner (own content is always
      // visible) plus, when the pin is public, anyone connected to or
      // following the owner. Symmetric accepted edges count either direction.
      const canSee = new Set<string>()
      if (owner && qualified.has(owner)) canSee.add(owner)
      if (owner && pin.visibility === "public" && qualified.size > 0) {
        const ids = [...qualified]
        const [followEdges, connRows] = await Promise.all([
          db
            .select({ followerId: follows.followerId })
            .from(follows)
            .where(
              and(eq(follows.followeeId, owner), inArray(follows.followerId, ids))
            ),
          db
            .select({
              followerId: connections.followerId,
              followeeId: connections.followeeId,
            })
            .from(connections)
            .where(
              and(
                eq(connections.status, "accepted"),
                or(
                  and(
                    eq(connections.followerId, owner),
                    inArray(connections.followeeId, ids)
                  ),
                  and(
                    inArray(connections.followerId, ids),
                    eq(connections.followeeId, owner)
                  )
                )
              )
            ),
        ])
        for (const e of followEdges) canSee.add(e.followerId)
        for (const c of connRows) {
          // Whichever side is the viewer (not the owner) is the connected follower.
          if (c.followerId === owner) canSee.add(c.followeeId)
          else canSee.add(c.followerId)
        }
      }
      // A follower must see EVERY target pin to see the comment.
      for (const f of [...qualified]) if (!canSee.has(f)) qualified.delete(f)
    }
  }

  if (qualified.size === 0) return
  await Promise.all(
    [...qualified].map((recipientUserId) =>
      notify({
        recipientUserId,
        actorUserId: authorId,
        type: "comment",
        refId: refId ?? null,
        context: created.body.slice(0, 200),
      })
    )
  )
}

// Parses a target from query params for GET /comments.
function targetWhereFromQuery(q: Record<string, string>): SQL {
  if (q.targetType === "pin") {
    if (!q.pinId) throw new Error("pinId is required for targetType=pin")
    return eq(comments.pinId, q.pinId)
  }
  if (q.targetType === "location") {
    if (!q.placeId) throw new Error("placeId is required for targetType=location")
    return eq(comments.placeId, q.placeId)
  }
  if (q.targetType === "route") {
    if (!q.routeStartPinId || !q.routeEndPinId)
      throw new Error("routeStartPinId and routeEndPinId are required for targetType=route")
    return and(
      eq(comments.routeStartPinId, q.routeStartPinId),
      eq(comments.routeEndPinId, q.routeEndPinId)
    )!
  }
  throw new Error("targetType must be pin, location, or route")
}

// Recomputes net votes and the viewer's vote for a single comment (after a vote).
async function getVoteState(commentId: string, userId?: string) {
  const [tally] = await db
    .select({ netVotes: sql<number>`COALESCE(SUM(${commentVotes.value})::int, 0)` })
    .from(commentVotes)
    .where(eq(commentVotes.commentId, commentId))
  let myVote: 1 | -1 | null = null
  if (userId) {
    const [mine] = await db
      .select({ value: commentVotes.value })
      .from(commentVotes)
      .where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId)))
      .limit(1)
    myVote = (mine?.value as 1 | -1) ?? null
  }
  return { netVotes: tally?.netVotes ?? 0, myVote }
}

// ============================================
// GET /comments?targetType=...&pinId=|placeId=|routeStartPinId=&routeEndPinId=
// The full threaded comment tree for one target (readable by guests).
// ============================================
router.get("/", async (req, res) => {
  try {
    let where: SQL
    try {
      where = targetWhereFromQuery(req.query as Record<string, string>)
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message })
    }

    // Pin/route targets are visibility-gated: only the owner, a connection, or
    // a follower of the pin owner(s) can read the thread. Location/place
    // targets stay community-open. Non-viewers get an empty list (no leak).
    const q = req.query as Record<string, string>
    if (q.targetType === "pin" || q.targetType === "route") {
      const pinIds =
        q.targetType === "pin" ? [q.pinId] : [q.routeStartPinId, q.routeEndPinId]
      const view = await checkPinsViewable(req.userId, pinIds)
      if (!view.ok) return res.json({ comments: [] })
    }

    const flat = await fetchComments(where, req.userId)
    res.json({ comments: buildThread(flat) })
  } catch (error) {
    console.error("Failed to get comments:", error)
    res.status(500).json({ error: "Failed to get comments" })
  }
})

// ============================================
// POST /comments  (logged-in only)
// Create a top-level comment or a reply. Replies inherit the parent's target.
// ============================================
router.post("/", requireAuth, async (req, res) => {
  const parsed = createCommentSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }

  const { body, parentId } = parsed.data
  const userId = req.userId!

  // A reply inherits everything from its parent — same target, same snapshot
  // point — so replies can never drift onto a different location.
  if (parentId) {
    const [parent] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, parentId))
      .limit(1)
    if (!parent) return res.status(404).json({ error: "Parent comment not found" })

    // Photos belong to route posts. A reply under a route thread may carry one,
    // but pin/location replies stay text-only — the field is otherwise meaningless.
    const replyImage = parsed.data.imageUrl
    if (replyImage && parent.targetType !== "route") {
      return res.status(400).json({ error: "Only route posts can include a photo" })
    }

    // A reply stands on the parent's target, so it obeys the same visibility
    // rules — you can't reply under a private/foreign pin's thread you can't see.
    if (parent.targetType === "pin" || parent.targetType === "route") {
      const ids =
        parent.targetType === "pin"
          ? [parent.pinId]
          : [parent.routeStartPinId, parent.routeEndPinId]
      const view = await checkPinsViewable(userId, ids)
      if (!view.ok) return res.status(403).json({ error: view.error })
    }

    const [created] = await db
      .insert(comments)
      .values({
        body,
        imageUrl: replyImage ?? null,
        parentId,
        targetType: parent.targetType,
        pinId: parent.pinId,
        placeId: parent.placeId,
        routeStartPinId: parent.routeStartPinId,
        routeEndPinId: parent.routeEndPinId,
        authorUserId: userId,
        latitude: parent.latitude,
        longitude: parent.longitude,
      })
      .returning()

    // Follow-activity: the author's followers who can see this thread are told.
    await notifyCommentFollowers(created)

    return res.status(201).json({
      comment: {
        id: created.id,
        body: created.body,
        imageUrl: created.imageUrl,
        parentId: created.parentId,
        createdAt: new Date(created.createdAt).toISOString(),
        author: { id: userId },
        netVotes: 0,
        myVote: null,
      },
    })
  }

  // Top-level comment — resolve the target and snapshot its coordinates.
  const targetType = parsed.data.targetType
  if (!targetType) return res.status(400).json({ error: "targetType is required" })

  // Only route posts (a start→end pin pair thread) accept a photo.
  const topImage = parsed.data.imageUrl
  if (topImage && targetType !== "route") {
    return res.status(400).json({ error: "Only route posts can include a photo" })
  }

  let pinId: string | null = null
  let placeId: string | null = null
  let routeStartPinId: string | null = null
  let routeEndPinId: string | null = null
  let latitude: number | null = null
  let longitude: number | null = null

  if (targetType === "pin") {
    if (!parsed.data.pinId) return res.status(400).json({ error: "pinId is required" })
    const pin = await db.query.pins.findFirst({ where: eq(pins.id, parsed.data.pinId) })
    if (!pin) return res.status(404).json({ error: "Pin not found" })
    const view = await checkPinsViewable(userId, [pin.id])
    if (!view.ok) return res.status(403).json({ error: view.error })
    pinId = pin.id
    latitude = pin.latitude
    longitude = pin.longitude
  } else if (targetType === "location") {
    if (!parsed.data.placeId) return res.status(400).json({ error: "placeId is required" })
    const place = await db.query.places.findFirst({ where: eq(places.id, parsed.data.placeId) })
    if (!place) return res.status(404).json({ error: "Place not found" })
    placeId = place.id
    if (parsed.data.latitude === undefined || parsed.data.longitude === undefined) {
      return res.status(400).json({ error: "latitude and longitude are required for location comments" })
    }
    latitude = parsed.data.latitude
    longitude = parsed.data.longitude
  } else if (targetType === "route") {
    if (!parsed.data.routeStartPinId || !parsed.data.routeEndPinId) {
      return res.status(400).json({ error: "routeStartPinId and routeEndPinId are required" })
    }
    const [start, end] = await Promise.all([
      db.query.pins.findFirst({ where: eq(pins.id, parsed.data.routeStartPinId) }),
      db.query.pins.findFirst({ where: eq(pins.id, parsed.data.routeEndPinId) }),
    ])
    if (!start || !end) return res.status(404).json({ error: "Route pin not found" })
    // A route is only visible/commentable when BOTH endpoints are — your own
    // pins, or public pins of someone you're connected to or follow.
    const view = await checkPinsViewable(userId, [start.id, end.id])
    if (!view.ok) return res.status(403).json({ error: view.error })
    routeStartPinId = start.id
    routeEndPinId = end.id
    latitude = (start.latitude + end.latitude) / 2
    longitude = (start.longitude + end.longitude) / 2
  }

  const [created] = await db
    .insert(comments)
    .values({
      body,
      imageUrl: topImage ?? null,
      targetType,
      pinId,
      placeId,
      routeStartPinId,
      routeEndPinId,
      authorUserId: userId,
      latitude,
      longitude,
    })
    .returning()

  // Follow-activity: the author's followers who can see this thread are told.
  await notifyCommentFollowers(created)

  res.status(201).json({
    comment: {
      id: created.id,
      body: created.body,
      imageUrl: created.imageUrl,
      parentId: created.parentId,
      createdAt: new Date(created.createdAt).toISOString(),
      author: { id: userId },
      netVotes: 0,
      myVote: null,
    },
  })
})

// ============================================
// POST /comments/:id/vote  (logged-in only)
// Upvote/downvote with toggle semantics — one vote per user per comment.
// Same value again removes the vote; the opposite value replaces it.
// ============================================
router.post("/:id/vote", requireAuth, async (req, res) => {
  const parsed = voteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }

  const [comment] = await db
    .select()
    .from(comments)
    .where(sql`${comments.id} = ${req.params.id}`)
    .limit(1)
  if (!comment) return res.status(404).json({ error: "Comment not found" })

  // Voting is part of reading a thread — same visibility rule as the listing.
  if (comment.targetType === "pin" || comment.targetType === "route") {
    const ids =
      comment.targetType === "pin"
        ? [comment.pinId]
        : [comment.routeStartPinId, comment.routeEndPinId]
    const view = await checkPinsViewable(req.userId, ids)
    if (!view.ok) return res.status(403).json({ error: view.error })
  }

  const { value } = parsed.data
  const userId = req.userId!

  const existing = await db.query.commentVotes.findFirst({
    where: and(eq(commentVotes.commentId, comment.id), eq(commentVotes.userId, userId)),
  })

  let newlyVoted = false
  if (existing) {
    if (existing.value === value) {
      // Unvote.
      await db.delete(commentVotes).where(eq(commentVotes.id, existing.id))
    } else {
      // Swap to the other direction.
      await db.update(commentVotes).set({ value }).where(eq(commentVotes.id, existing.id))
    }
  } else {
    await db.insert(commentVotes).values({ commentId: comment.id, userId, value })
    newlyVoted = true
  }

  // Toast the author when someone casts a FIRST vote on their comment — never
  // on a vote removal, a direction flip, or a vote on their own comment.
  if (newlyVoted && comment.authorUserId !== userId) {
    await notify({
      recipientUserId: comment.authorUserId,
      actorUserId: userId,
      type: "comment_vote",
      refId: comment.id,
      context: comment.body.slice(0, 200),
    })
  }

  res.json(await getVoteState(comment.id, userId))
})

// ============================================
// DELETE /comments/:id  (author only)
// Replies cascade-delete via the parent_id FK.
// ============================================
router.delete("/:id", requireAuth, async (req, res) => {
  const [comment] = await db
    .select()
    .from(comments)
    .where(sql`${comments.id} = ${req.params.id}`)
    .limit(1)
  if (!comment) return res.status(404).json({ error: "Comment not found" })
  if (comment.authorUserId !== req.userId) {
    return res.status(403).json({ error: "You can only delete your own comments" })
  }

  await db.delete(comments).where(eq(comments.id, comment.id))
  res.status(204).send()
})

// ============================================
// GET /comments/counts?pinIds=a,b,c  (readable by guests)
// Per-pin comment counts for marker badges. A pin's count adds up comments
// targeted directly at it (targetType='pin') plus comments on routes that
// involve the pin as an endpoint (targetType='route', matching either
// routeStartPinId or routeEndPinId) — so a route comment badges both of its
// endpoint pins. Replies inherit their parent's target columns, so they count
// toward the same pin. Pins with no comments are simply absent from the map.
// ============================================
router.get("/counts", async (req, res) => {
  const raw = String(req.query.pinIds ?? "")
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (ids.length === 0) return res.json({ counts: {} })
  if (ids.length > 500) return res.status(400).json({ error: "Too many pin ids" })

  try {
    const [pinRows, routeStartRows, routeEndRows] = await Promise.all([
      db
        .select({ pinId: comments.pinId, count: sql<number>`count(*)::int` })
        .from(comments)
        .where(and(eq(comments.targetType, "pin"), inArray(comments.pinId, ids)))
        .groupBy(comments.pinId),
      db
        .select({ pinId: comments.routeStartPinId, count: sql<number>`count(*)::int` })
        .from(comments)
        .where(and(eq(comments.targetType, "route"), inArray(comments.routeStartPinId, ids)))
        .groupBy(comments.routeStartPinId),
      db
        .select({ pinId: comments.routeEndPinId, count: sql<number>`count(*)::int` })
        .from(comments)
        .where(and(eq(comments.targetType, "route"), inArray(comments.routeEndPinId, ids)))
        .groupBy(comments.routeEndPinId),
    ])

    const counts: Record<string, number> = {}
    for (const rows of [pinRows, routeStartRows, routeEndRows]) {
      for (const r of rows) {
        if (r.pinId) counts[r.pinId] = (counts[r.pinId] ?? 0) + Number(r.count)
      }
    }
    res.json({ counts })
  } catch (error) {
    console.error("Failed to get comment counts:", error)
    res.status(500).json({ error: "Failed to get comment counts" })
  }
})

// ============================================
// GET /comments/routes  (readable by guests)
// Every distinct route (start pin → end pin) that has comments, with the
// comment count and both endpoint pins' names + coordinates. Drives the map
// overlay (dashed route lines + count badges) so route conversations are
// discoverable, not just badged on the endpoint pins.
// ============================================
router.get("/routes", async (req, res) => {
  try {
    const grouped = await db
      .select({
        routeStartPinId: comments.routeStartPinId,
        routeEndPinId: comments.routeEndPinId,
        count: sql<number>`count(*)::int`,
      })
      .from(comments)
      .where(eq(comments.targetType, "route"))
      .groupBy(comments.routeStartPinId, comments.routeEndPinId)

    if (grouped.length === 0) return res.json({ routes: [] })

    // Batch-load both endpoints for every route so we can attach names + coords.
    const pinIds = new Set<string>()
    for (const r of grouped) {
      if (r.routeStartPinId) pinIds.add(r.routeStartPinId)
      if (r.routeEndPinId) pinIds.add(r.routeEndPinId)
    }
    const pinRows = await db
      .select({
        id: pins.id,
        name: pins.name,
        customName: pins.customName,
        latitude: pins.latitude,
        longitude: pins.longitude,
      })
      .from(pins)
      .where(inArray(pins.id, [...pinIds]))
    const pinMap = new Map(pinRows.map((p) => [p.id, p]))

    const routes = grouped
      .filter((r) => r.routeStartPinId && r.routeEndPinId)
      .map((r) => {
        const start = pinMap.get(r.routeStartPinId!)
        const end = pinMap.get(r.routeEndPinId!)
        return {
          routeStartPinId: r.routeStartPinId!,
          routeEndPinId: r.routeEndPinId!,
          count: r.count,
          startName: start?.customName || start?.name || "A",
          endName: end?.customName || end?.name || "B",
          startLat: start?.latitude ?? null,
          startLng: start?.longitude ?? null,
          endLat: end?.latitude ?? null,
          endLng: end?.longitude ?? null,
        }
      })
      .filter((r) => r.startLat != null && r.endLat != null)

    res.json({ routes })
  } catch (error) {
    console.error("Failed to get comment routes:", error)
    res.status(500).json({ error: "Failed to get comment routes" })
  }
})

// ============================================
// GET /comments/relevant?lat=&lng=  (readable by guests)
// Phase 2 — the community comment widget. Finds the comment-bearing location
// nearest the given viewport point (using the lat/lng snapshot on each
// comment), then returns that location's comments as a flat list in
// descending vote order so the widget can step through them with "Next".
// ============================================
router.get("/relevant", async (req, res) => {
  // Route-targeted query — the widget is showing a specific route (the user
  // clicked a path). Return that route's comments directly instead of the
  // nearest comment-bearing location to a point.
  const routeStartPinId = typeof req.query.routeStartPinId === "string" ? req.query.routeStartPinId : undefined
  const routeEndPinId = typeof req.query.routeEndPinId === "string" ? req.query.routeEndPinId : undefined

  if (routeStartPinId && routeEndPinId) {
    try {
      const where = and(
        eq(comments.routeStartPinId, routeStartPinId),
        eq(comments.routeEndPinId, routeEndPinId)
      )!
      const flat = await fetchComments(where, req.userId)
      flat.sort(
        (a, b) =>
          b.netVotes - a.netVotes ||
          a.createdAt.localeCompare(b.createdAt)
      )
      const [s, e] = await Promise.all([
        db.query.pins.findFirst({ where: eq(pins.id, routeStartPinId) }),
        db.query.pins.findFirst({ where: eq(pins.id, routeEndPinId) }),
      ])
      return res.json({
        target: {
          type: "route",
          routeStartPinId,
          routeEndPinId,
          name: `Route: ${s?.customName || s?.name || "A"} → ${e?.customName || e?.name || "B"}`,
        },
        comments: flat,
      })
    } catch (error) {
      console.error("Failed to find route comments:", error)
      return res.status(500).json({ error: "Failed to find route comments" })
    }
  }

  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "lat and lng are required" })
  }

  try {
    const [nearest] = await db.execute<{ targetKey: string }>(sql`
      SELECT
        COALESCE(
          'pin:' || ${comments.pinId}::text,
          'loc:' || ${comments.placeId}::text,
          'route:' || ${comments.routeStartPinId}::text || ':' || ${comments.routeEndPinId}::text
        ) AS "targetKey",
        MIN(POW(${comments.latitude} - ${lat}, 2) + POW(${comments.longitude} - ${lng}, 2)) AS d2,
        MIN(${comments.createdAt}) AS earliest
      FROM ${comments}
      WHERE ${comments.latitude} IS NOT NULL AND ${comments.longitude} IS NOT NULL
      GROUP BY 1
      ORDER BY d2, earliest
      LIMIT 1
    `)

    if (!nearest) return res.json({ target: null, comments: [] })

    // Parse the target key back into structured IDs.
    const key = nearest.targetKey
    let targetType: "pin" | "location" | "route"
    let pinId: string | null = null
    let placeId: string | null = null
    let routeStartPinId: string | null = null
    let routeEndPinId: string | null = null

    if (key.startsWith("pin:")) {
      targetType = "pin"
      pinId = key.slice(4)
    } else if (key.startsWith("loc:")) {
      targetType = "location"
      placeId = key.slice(4)
    } else if (key.startsWith("route:")) {
      targetType = "route"
      const [s, e] = key.slice(6).split(":")
      routeStartPinId = s ?? null
      routeEndPinId = e ?? null
    } else {
      return res.status(500).json({ error: "Unexpected target key" })
    }

    const where =
      targetType === "pin"
        ? eq(comments.pinId, pinId!)
        : targetType === "location"
          ? eq(comments.placeId, placeId!)
          : and(
              eq(comments.routeStartPinId, routeStartPinId!),
              eq(comments.routeEndPinId, routeEndPinId!)
            )!

    const flat = await fetchComments(where, req.userId)
    flat.sort(
      (a, b) =>
        b.netVotes - a.netVotes ||
        a.createdAt.localeCompare(b.createdAt)
    )

    // Resolve a display name for the target.
    let name = "Unknown location"
    if (targetType === "pin" && pinId) {
      const pin = await db.query.pins.findFirst({ where: eq(pins.id, pinId) })
      if (pin) name = pin.customName || pin.name
    } else if (targetType === "location" && placeId) {
      const place = await db.query.places.findFirst({ where: eq(places.id, placeId) })
      if (place) name = place.name
    } else if (targetType === "route" && routeStartPinId && routeEndPinId) {
      const [s, e] = await Promise.all([
        db.query.pins.findFirst({ where: eq(pins.id, routeStartPinId) }),
        db.query.pins.findFirst({ where: eq(pins.id, routeEndPinId) }),
      ])
      name = `Route: ${s?.customName || s?.name || "A"} → ${e?.customName || e?.name || "B"}`
    }

    res.json({
      target: {
        type: targetType,
        pinId,
        placeId,
        routeStartPinId,
        routeEndPinId,
        name,
      },
      comments: flat,
    })
  } catch (error) {
    console.error("Failed to find relevant comments:", error)
    res.status(500).json({ error: "Failed to find relevant comments" })
  }
})

export default router
