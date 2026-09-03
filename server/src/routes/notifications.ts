// routes/notifications.ts
// In-app notifications read API (requireAuth only — guests are never recipients,
// so every route 401s them exactly like /community does).
//
//   GET  /notifications              -> { notifications: NotificationRow[] }
//   GET  /notifications/unread-count -> { total }
//   POST /notifications/read         { ids?: string[] } -> { ok: true }
//
// NotificationRow = { id, type, refId, context, createdAt, readAt,
//                     actor: Profile | null }. Rows are newest first; the
// frontend polls GET /notifications + /unread-count together every ~10s (both
// are cheap GETs well under the general rate tier) and pops a toast for each
// unread row it hasn't seen yet. POST /read with ids marks those read, or all
// when omitted — the bell calls it when it opens.
import { Router } from "express"
import { eq, and, isNull, inArray, desc, sql } from "drizzle-orm"
import { db } from "../db/index.ts"
import { notifications, users } from "../db/schema.ts"
import { requireAuth } from "../middleware/auth.ts"

const router = Router()
router.use(requireAuth)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The feed, newest first, with the actor's profile left-joined (null when the
// actor has been deleted or the event is system-ish).
router.get("/", async (req, res) => {
  try {
    const me = req.userId!
    const raw = Number(req.query.limit)
    const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 100) : 50

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        refId: notifications.refId,
        context: notifications.context,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
        actorUserId: users.id,
        actorFirstName: users.firstName,
        actorLastName: users.lastName,
        actorProfileImage: users.profileImage,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorUserId, users.id))
      .where(eq(notifications.recipientUserId, me))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)

    res.json({
      notifications: rows.map((r) => ({
        id: r.id,
        type: r.type,
        refId: r.refId,
        context: r.context,
        createdAt: new Date(r.createdAt).toISOString(),
        readAt: r.readAt ? new Date(r.readAt).toISOString() : null,
        actor: r.actorUserId
          ? {
              userId: r.actorUserId,
              firstName: r.actorFirstName,
              lastName: r.actorLastName,
              profileImage: r.actorProfileImage,
            }
          : null,
      })),
    })
  } catch (err) {
    console.error("Failed to load notifications:", err)
    res.status(500).json({ error: "Failed to load notifications" })
  }
})

// Unread count for the bell badge.
router.get("/unread-count", async (req, res) => {
  try {
    const me = req.userId!
    const [row] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, me), isNull(notifications.readAt)))
    res.json({ total: row?.total ?? 0 })
  } catch (err) {
    console.error("Failed to count unread notifications:", err)
    res.status(500).json({ error: "Failed to count unread notifications" })
  }
})

// Mark notifications read. Pass `ids` to mark a subset (the bell marks the
// whole visible page, the chat thread marks its own message rows); omit ids to
// clear everything. Never touches another user's rows.
router.post("/read", async (req, res) => {
  try {
    const me = req.userId!
    const rawIds: unknown = req.body?.ids
    const ids: string[] = Array.isArray(rawIds)
      ? rawIds.filter((x): x is string => typeof x === "string" && UUID_RE.test(x))
      : []

    const base = [eq(notifications.recipientUserId, me), isNull(notifications.readAt)]
    if (ids.length > 0) {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(...base, inArray(notifications.id, ids)))
    } else {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(...base))
    }
    res.json({ ok: true })
  } catch (err) {
    console.error("Failed to mark notifications read:", err)
    res.status(500).json({ error: "Failed to mark notifications read" })
  }
})

export default router
