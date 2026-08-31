// routes/comments.ts
import { Router } from "express";
import { z } from "zod";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { comments, commentVotes, users, pins, places } from "../db/schema.ts";
import { optionalAuth, requireAuth } from "../middleware/auth.ts";
import { ensureGuestSession } from "../middleware/guest.ts";
const router = Router();
// ============================================
// SCHEMAS
// ============================================
const createCommentSchema = z.object({
    body: z.string().min(1, "Comment is required").max(2000, "Comment is too long"),
    parentId: z.string().uuid().optional(),
    targetType: z.enum(["pin", "location", "route"]).optional(),
    pinId: z.string().uuid().optional(),
    placeId: z.string().uuid().optional(),
    routeStartPinId: z.string().uuid().optional(),
    routeEndPinId: z.string().uuid().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
});
const voteSchema = z.object({
    value: z.union([z.literal(1), z.literal(-1)]),
});
// ============================================
// MIDDLEWARE
// ============================================
// Comments are readable by everyone (guests included); only logged-in users
// may write or vote. So reads pass through optionalAuth (attaches req.userId
// when a real session exists) and the write/vote/delete routes use requireAuth.
router.use(optionalAuth, ensureGuestSession);
// ============================================
// HELPERS
// ============================================
// Fetches every comment matching `whereClause`, plus its author, net vote
// tally, and (if logged in) the viewer's own vote. Returns flat rows in no
// particular order — callers build the thread or sort for display.
async function fetchComments(whereClause, userId) {
    const rows = await db
        .select({
        id: comments.id,
        body: comments.body,
        parentId: comments.parentId,
        createdAt: comments.createdAt,
        authorId: users.id,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorProfileImage: users.profileImage,
    })
        .from(comments)
        .innerJoin(users, eq(comments.authorUserId, users.id))
        .where(whereClause);
    if (rows.length === 0)
        return [];
    const ids = rows.map((r) => r.id);
    // Net votes: SUM(value) per comment. SUM(int) returns bigint, which the
    // postgres-js driver serializes as a string — cast to int so it stays a number.
    const tallyRows = await db
        .select({
        commentId: commentVotes.commentId,
        netVotes: sql `COALESCE(SUM(${commentVotes.value})::int, 0)`,
    })
        .from(commentVotes)
        .where(inArray(commentVotes.commentId, ids))
        .groupBy(commentVotes.commentId);
    const tallyMap = new Map(tallyRows.map((r) => [r.commentId, r.netVotes]));
    // The viewer's own vote, if logged in.
    const myVoteMap = new Map();
    if (userId) {
        const myVotes = await db
            .select({ commentId: commentVotes.commentId, value: commentVotes.value })
            .from(commentVotes)
            .where(and(inArray(commentVotes.commentId, ids), eq(commentVotes.userId, userId)));
        for (const v of myVotes)
            myVoteMap.set(v.commentId, v.value);
    }
    return rows.map((r) => ({
        id: r.id,
        body: r.body,
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
    }));
}
// Groups flat comments by parentId into a nested thread. Every level is sorted
// by net votes (highest first), ties broken by creation time (earliest first).
function buildThread(flat) {
    const nodes = new Map();
    for (const c of flat)
        nodes.set(c.id, { ...c, replies: [] });
    const roots = [];
    for (const node of nodes.values()) {
        if (node.parentId && nodes.has(node.parentId)) {
            nodes.get(node.parentId).replies.push(node);
        }
        else {
            roots.push(node);
        }
    }
    const sortRecursive = (list) => {
        list.sort((a, b) => b.netVotes - a.netVotes ||
            a.createdAt.localeCompare(b.createdAt));
        for (const node of list)
            node.replies = sortRecursive(node.replies);
        return list;
    };
    return sortRecursive(roots);
}
// Parses a target from query params for GET /comments.
function targetWhereFromQuery(q) {
    if (q.targetType === "pin") {
        if (!q.pinId)
            throw new Error("pinId is required for targetType=pin");
        return eq(comments.pinId, q.pinId);
    }
    if (q.targetType === "location") {
        if (!q.placeId)
            throw new Error("placeId is required for targetType=location");
        return eq(comments.placeId, q.placeId);
    }
    if (q.targetType === "route") {
        if (!q.routeStartPinId || !q.routeEndPinId)
            throw new Error("routeStartPinId and routeEndPinId are required for targetType=route");
        return and(eq(comments.routeStartPinId, q.routeStartPinId), eq(comments.routeEndPinId, q.routeEndPinId));
    }
    throw new Error("targetType must be pin, location, or route");
}
// Recomputes net votes and the viewer's vote for a single comment (after a vote).
async function getVoteState(commentId, userId) {
    const [tally] = await db
        .select({ netVotes: sql `COALESCE(SUM(${commentVotes.value})::int, 0)` })
        .from(commentVotes)
        .where(eq(commentVotes.commentId, commentId));
    let myVote = null;
    if (userId) {
        const [mine] = await db
            .select({ value: commentVotes.value })
            .from(commentVotes)
            .where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId)))
            .limit(1);
        myVote = mine?.value ?? null;
    }
    return { netVotes: tally?.netVotes ?? 0, myVote };
}
// ============================================
// GET /comments?targetType=...&pinId=|placeId=|routeStartPinId=&routeEndPinId=
// The full threaded comment tree for one target (readable by guests).
// ============================================
router.get("/", async (req, res) => {
    try {
        let where;
        try {
            where = targetWhereFromQuery(req.query);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
        const flat = await fetchComments(where, req.userId);
        res.json({ comments: buildThread(flat) });
    }
    catch (error) {
        console.error("Failed to get comments:", error);
        res.status(500).json({ error: "Failed to get comments" });
    }
});
// ============================================
// POST /comments  (logged-in only)
// Create a top-level comment or a reply. Replies inherit the parent's target.
// ============================================
router.post("/", requireAuth, async (req, res) => {
    const parsed = createCommentSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { body, parentId } = parsed.data;
    const userId = req.userId;
    // A reply inherits everything from its parent — same target, same snapshot
    // point — so replies can never drift onto a different location.
    if (parentId) {
        const [parent] = await db
            .select()
            .from(comments)
            .where(eq(comments.id, parentId))
            .limit(1);
        if (!parent)
            return res.status(404).json({ error: "Parent comment not found" });
        const [created] = await db
            .insert(comments)
            .values({
            body,
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
            .returning();
        return res.status(201).json({
            comment: {
                id: created.id,
                body: created.body,
                parentId: created.parentId,
                createdAt: new Date(created.createdAt).toISOString(),
                author: { id: userId },
                netVotes: 0,
                myVote: null,
            },
        });
    }
    // Top-level comment — resolve the target and snapshot its coordinates.
    const targetType = parsed.data.targetType;
    if (!targetType)
        return res.status(400).json({ error: "targetType is required" });
    let pinId = null;
    let placeId = null;
    let routeStartPinId = null;
    let routeEndPinId = null;
    let latitude = null;
    let longitude = null;
    if (targetType === "pin") {
        if (!parsed.data.pinId)
            return res.status(400).json({ error: "pinId is required" });
        const pin = await db.query.pins.findFirst({ where: eq(pins.id, parsed.data.pinId) });
        if (!pin)
            return res.status(404).json({ error: "Pin not found" });
        pinId = pin.id;
        latitude = pin.latitude;
        longitude = pin.longitude;
    }
    else if (targetType === "location") {
        if (!parsed.data.placeId)
            return res.status(400).json({ error: "placeId is required" });
        const place = await db.query.places.findFirst({ where: eq(places.id, parsed.data.placeId) });
        if (!place)
            return res.status(404).json({ error: "Place not found" });
        placeId = place.id;
        if (parsed.data.latitude === undefined || parsed.data.longitude === undefined) {
            return res.status(400).json({ error: "latitude and longitude are required for location comments" });
        }
        latitude = parsed.data.latitude;
        longitude = parsed.data.longitude;
    }
    else if (targetType === "route") {
        if (!parsed.data.routeStartPinId || !parsed.data.routeEndPinId) {
            return res.status(400).json({ error: "routeStartPinId and routeEndPinId are required" });
        }
        const [start, end] = await Promise.all([
            db.query.pins.findFirst({ where: eq(pins.id, parsed.data.routeStartPinId) }),
            db.query.pins.findFirst({ where: eq(pins.id, parsed.data.routeEndPinId) }),
        ]);
        if (!start || !end)
            return res.status(404).json({ error: "Route pin not found" });
        routeStartPinId = start.id;
        routeEndPinId = end.id;
        latitude = (start.latitude + end.latitude) / 2;
        longitude = (start.longitude + end.longitude) / 2;
    }
    const [created] = await db
        .insert(comments)
        .values({
        body,
        targetType,
        pinId,
        placeId,
        routeStartPinId,
        routeEndPinId,
        authorUserId: userId,
        latitude,
        longitude,
    })
        .returning();
    res.status(201).json({
        comment: {
            id: created.id,
            body: created.body,
            parentId: created.parentId,
            createdAt: new Date(created.createdAt).toISOString(),
            author: { id: userId },
            netVotes: 0,
            myVote: null,
        },
    });
});
// ============================================
// POST /comments/:id/vote  (logged-in only)
// Upvote/downvote with toggle semantics — one vote per user per comment.
// Same value again removes the vote; the opposite value replaces it.
// ============================================
router.post("/:id/vote", requireAuth, async (req, res) => {
    const parsed = voteSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const [comment] = await db
        .select()
        .from(comments)
        .where(sql `${comments.id} = ${req.params.id}`)
        .limit(1);
    if (!comment)
        return res.status(404).json({ error: "Comment not found" });
    const { value } = parsed.data;
    const userId = req.userId;
    const existing = await db.query.commentVotes.findFirst({
        where: and(eq(commentVotes.commentId, comment.id), eq(commentVotes.userId, userId)),
    });
    if (existing) {
        if (existing.value === value) {
            // Unvote.
            await db.delete(commentVotes).where(eq(commentVotes.id, existing.id));
        }
        else {
            // Swap to the other direction.
            await db.update(commentVotes).set({ value }).where(eq(commentVotes.id, existing.id));
        }
    }
    else {
        await db.insert(commentVotes).values({ commentId: comment.id, userId, value });
    }
    res.json(await getVoteState(comment.id, userId));
});
// ============================================
// DELETE /comments/:id  (author only)
// Replies cascade-delete via the parent_id FK.
// ============================================
router.delete("/:id", requireAuth, async (req, res) => {
    const [comment] = await db
        .select()
        .from(comments)
        .where(sql `${comments.id} = ${req.params.id}`)
        .limit(1);
    if (!comment)
        return res.status(404).json({ error: "Comment not found" });
    if (comment.authorUserId !== req.userId) {
        return res.status(403).json({ error: "You can only delete your own comments" });
    }
    await db.delete(comments).where(eq(comments.id, comment.id));
    res.status(204).send();
});
// ============================================
// GET /comments/relevant?lat=&lng=  (readable by guests)
// Phase 2 — the community comment widget. Finds the comment-bearing location
// nearest the given viewport point (using the lat/lng snapshot on each
// comment), then returns that location's comments as a flat list in
// descending vote order so the widget can step through them with "Next".
// ============================================
router.get("/relevant", async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: "lat and lng are required" });
    }
    try {
        const [nearest] = await db.execute(sql `
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
    `);
        if (!nearest)
            return res.json({ target: null, comments: [] });
        // Parse the target key back into structured IDs.
        const key = nearest.targetKey;
        let targetType;
        let pinId = null;
        let placeId = null;
        let routeStartPinId = null;
        let routeEndPinId = null;
        if (key.startsWith("pin:")) {
            targetType = "pin";
            pinId = key.slice(4);
        }
        else if (key.startsWith("loc:")) {
            targetType = "location";
            placeId = key.slice(4);
        }
        else if (key.startsWith("route:")) {
            targetType = "route";
            const [s, e] = key.slice(6).split(":");
            routeStartPinId = s ?? null;
            routeEndPinId = e ?? null;
        }
        else {
            return res.status(500).json({ error: "Unexpected target key" });
        }
        const where = targetType === "pin"
            ? eq(comments.pinId, pinId)
            : targetType === "location"
                ? eq(comments.placeId, placeId)
                : and(eq(comments.routeStartPinId, routeStartPinId), eq(comments.routeEndPinId, routeEndPinId));
        const flat = await fetchComments(where, req.userId);
        flat.sort((a, b) => b.netVotes - a.netVotes ||
            a.createdAt.localeCompare(b.createdAt));
        // Resolve a display name for the target.
        let name = "Unknown location";
        if (targetType === "pin" && pinId) {
            const pin = await db.query.pins.findFirst({ where: eq(pins.id, pinId) });
            if (pin)
                name = pin.customName || pin.name;
        }
        else if (targetType === "location" && placeId) {
            const place = await db.query.places.findFirst({ where: eq(places.id, placeId) });
            if (place)
                name = place.name;
        }
        else if (targetType === "route" && routeStartPinId && routeEndPinId) {
            const [s, e] = await Promise.all([
                db.query.pins.findFirst({ where: eq(pins.id, routeStartPinId) }),
                db.query.pins.findFirst({ where: eq(pins.id, routeEndPinId) }),
            ]);
            name = `Route: ${s?.customName || s?.name || "A"} → ${e?.customName || e?.name || "B"}`;
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
        });
    }
    catch (error) {
        console.error("Failed to find relevant comments:", error);
        res.status(500).json({ error: "Failed to find relevant comments" });
    }
});
export default router;
