// routes/groups.ts
// Community group chat (Telegram-style) between registered users.
//
// A group is created by one user; membership is DIRECT-ADD — the creator adds
// anyone (no accept), added members are in immediately, and any member can
// leave whenever they want. Only the creator can add/remove others or delete
// the group. Messaging inside a group needs no connection between members —
// the group itself is the shared space.
//
// Unread tracking per member mirrors the 1:1 DM model: `groupMembers.lastReadAt`
// is a cursor, and unread = messages by OTHERS written after it. Opening a group
// marks it read AND clears that group's group_added/group_message notifications
// so the bell stops re-toasting a just-opened thread.
//
// Response shapes:
//   POST /groups { name, memberUserIds[] }      -> 201 { group }
//   GET  /groups                                -> { groups: GroupSummary[] }
//   GET  /groups/:id/messages                   -> { group, members, messages }
//   POST /groups/:id/messages  { body }         -> 201 { message }
//   POST /groups/:id/read                       -> { ok: true }
//   POST /groups/:id/members  { userId }        -> { ok: true }   (creator)
//   DELETE /groups/:id/members/:userId          -> { ok: true }   (creator)
//   POST /groups/:id/leave                      -> { ok: true }   (any member)
//   DELETE /groups/:id                          -> 204            (creator)
//
// GroupSummary = { id, name, createdBy: Profile | null, mine: boolean,
//                  memberCount, lastMessage: GroupMessage | null,
//                  unreadCount, updatedAt }
// GroupMessage = { id, groupId, authorUserId, body, createdAt, author: Profile }
import { Router } from "express"
import { eq, and, ne, gt, isNull, inArray, desc, asc, sql } from "drizzle-orm"
import { db } from "../db/index.ts"
import {
  users,
  groups,
  groupMembers,
  groupMessages,
  notifications,
} from "../db/schema.ts"
import { requireAuth } from "../middleware/auth.ts"
import { notify } from "../lib/notify.ts"

const router = Router()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NAME_MAX = 80
const MAX_ADD = 50
const MESSAGE_MAX = 4000

type Profile = {
  userId: string
  firstName: string
  lastName: string
  profileImage: string | null
}

function paramStr(value: unknown): string | null {
  return typeof value === "string" ? value : null
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

async function isMember(groupId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1)
  return rows.length > 0
}

// Message rows join the author's profile so the UI can label senders even after
// someone has left the group (their old messages keep the name they had).
const MESSAGE_AUTHOR_COLS = {
  id: groupMessages.id,
  groupId: groupMessages.groupId,
  authorUserId: groupMessages.authorUserId,
  body: groupMessages.body,
  createdAt: groupMessages.createdAt,
  authorFirstName: users.firstName,
  authorLastName: users.lastName,
  authorProfileImage: users.profileImage,
}

function toGroupMessage(row: {
  id: string
  groupId: string
  authorUserId: string
  body: string
  createdAt: Date
  authorFirstName: string | null
  authorLastName: string | null
  authorProfileImage: string | null
}) {
  return {
    id: row.id,
    groupId: row.groupId,
    authorUserId: row.authorUserId,
    body: row.body,
    createdAt: row.createdAt,
    author: profileOf({
      userId: row.authorUserId,
      firstName: row.authorFirstName ?? "",
      lastName: row.authorLastName ?? "",
      profileImage: row.authorProfileImage,
    }),
  }
}

// Latest-200 ascending on a full open; with an `after` cursor (the 5s poller)
// only rows newer than it come back. Authors joined either way.
async function loadMessagesOf(gid: string, afterTime?: Date | null) {
  if (afterTime) {
    const rows = await db
      .select(MESSAGE_AUTHOR_COLS)
      .from(groupMessages)
      .innerJoin(users, eq(groupMessages.authorUserId, users.id))
      .where(and(eq(groupMessages.groupId, gid), gt(groupMessages.createdAt, afterTime)))
      .orderBy(asc(groupMessages.createdAt))
    return rows.map(toGroupMessage)
  }
  const rows = await db
    .select(MESSAGE_AUTHOR_COLS)
    .from(groupMessages)
    .innerJoin(users, eq(groupMessages.authorUserId, users.id))
    .where(eq(groupMessages.groupId, gid))
    .orderBy(desc(groupMessages.createdAt))
    .limit(200)
  return rows.reverse().map(toGroupMessage)
}

async function lastMessageOf(gid: string) {
  const rows = await db
    .select(MESSAGE_AUTHOR_COLS)
    .from(groupMessages)
    .innerJoin(users, eq(groupMessages.authorUserId, users.id))
    .where(eq(groupMessages.groupId, gid))
    .orderBy(desc(groupMessages.createdAt))
    .limit(1)
  return rows.length ? toGroupMessage(rows[0]) : null
}

// ---- Create ----
router.post("/", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const name = (
      typeof req.body?.name === "string" ? req.body.name.trim() : ""
    ).slice(0, NAME_MAX)
    if (!name) {
      return res.status(400).json({ error: "Group name is required" })
    }

    const rawIds = Array.isArray(req.body?.memberUserIds) ? req.body.memberUserIds : []
    const memberIds = Array.from(
      new Set(
        rawIds.filter((v): v is string => typeof v === "string" && UUID_RE.test(v))
      )
    )
      .filter((id) => id !== me)
      .slice(0, MAX_ADD)

    // The FK would fail on a bogus uuid with a 500; validate up front instead.
    if (memberIds.length > 0) {
      const found = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, memberIds))
      if (found.length !== memberIds.length) {
        return res.status(400).json({ error: "Some travelers no longer exist" })
      }
    }

    const [created] = await db
      .insert(groups)
      .values({ name, createdByUserId: me })
      .returning({
        id: groups.id,
        name: groups.name,
        createdAt: groups.createdAt,
        updatedAt: groups.updatedAt,
      })
    const gid = created.id

    await db
      .insert(groupMembers)
      .values([
        { groupId: gid, userId: me },
        ...memberIds.map((userId) => ({ groupId: gid, userId })),
      ])
      .onConflictDoNothing()

    // Telegram-style: added people are members instantly, with a heads-up.
    await Promise.all(
      memberIds.map((userId) =>
        notify({
          recipientUserId: userId,
          actorUserId: me,
          type: "group_added",
          refId: gid,
          context: name,
        })
      )
    )

    res.status(201).json({
      group: {
        id: gid,
        name,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        mine: true,
      },
    })
  } catch (err) {
    console.error("Failed to create group:", err)
    res.status(500).json({ error: "Failed to create group" })
  }
})

// ---- My groups (inbox) ----
router.get("/", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const memberships = await db
      .select({ groupId: groupMembers.groupId, lastReadAt: groupMembers.lastReadAt })
      .from(groupMembers)
      .where(eq(groupMembers.userId, me))
    if (memberships.length === 0) return res.json({ groups: [] })

    const gids = memberships.map((m) => m.groupId)
    const lastReadByGroup = new Map(memberships.map((m) => [m.groupId, m.lastReadAt]))

    const [grpRows, memberCountRows] = await Promise.all([
      db
        .select({
          id: groups.id,
          name: groups.name,
          createdByUserId: groups.createdByUserId,
          updatedAt: groups.updatedAt,
        })
        .from(groups)
        .where(inArray(groups.id, gids))
        .orderBy(desc(groups.updatedAt)),
      db
        .select({
          groupId: groupMembers.groupId,
          n: sql<number>`count(*)::int`,
        })
        .from(groupMembers)
        .where(inArray(groupMembers.groupId, gids))
        .groupBy(groupMembers.groupId),
    ])
    const memberCounts = new Map(memberCountRows.map((r) => [r.groupId, r.n]))

    const creatorIds = Array.from(new Set(grpRows.map((g) => g.createdByUserId)))
    const creatorRows = creatorIds.length
      ? await db
          .select({
            userId: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImage: users.profileImage,
          })
          .from(users)
          .where(inArray(users.id, creatorIds))
      : []
    const creatorById = new Map(creatorRows.map((r) => [r.userId, profileOf(r)]))

    const summaries = await Promise.all(
      grpRows.map(async (g) => {
        const lastMessage = await lastMessageOf(g.id)
        const lastReadAt = lastReadByGroup.get(g.id) ?? null
        const conds = [eq(groupMessages.groupId, g.id), ne(groupMessages.authorUserId, me)]
        if (lastReadAt) conds.push(gt(groupMessages.createdAt, lastReadAt))
        const unreadRows = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(groupMessages)
          .where(and(...conds))
        return {
          id: g.id,
          name: g.name,
          createdBy: creatorById.get(g.createdByUserId) ?? null,
          mine: g.createdByUserId === me,
          memberCount: memberCounts.get(g.id) ?? 0,
          lastMessage,
          unreadCount: unreadRows[0]?.n ?? 0,
          updatedAt: g.updatedAt,
        }
      })
    )

    res.json({ groups: summaries })
  } catch (err) {
    console.error("Failed to list groups:", err)
    res.status(500).json({ error: "Failed to list groups" })
  }
})

// ---- One group's thread + members ----
router.get("/:id/messages", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const gid = paramStr(req.params.id)
    if (!gid || !UUID_RE.test(gid)) {
      return res.status(400).json({ error: "Invalid group id" })
    }
    if (!(await isMember(gid, me))) {
      return res.status(403).json({ error: "You're not a member of this group" })
    }

    const [grp, memberCountRows] = await Promise.all([
      db
        .select({
          id: groups.id,
          name: groups.name,
          createdByUserId: groups.createdByUserId,
          updatedAt: groups.updatedAt,
        })
        .from(groups)
        .where(eq(groups.id, gid))
        .limit(1),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, gid)),
    ])
    if (!grp) return res.status(404).json({ error: "Group not found" })

    // ?after=<ISO> polls only messages newer than the cursor (the open chat's
    // 5s tick); a full open (no after) fetches the newest 200, ascending.
    const afterRaw = typeof req.query.after === "string" ? req.query.after : null
    const afterTime = afterRaw ? new Date(afterRaw) : null
    const msgRows = await loadMessagesOf(
      gid,
      afterTime && !Number.isNaN(afterTime.getTime()) ? afterTime : null
    )

    const [creatorRows, memberRows] = await Promise.all([
      db
        .select({
          userId: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImage: users.profileImage,
        })
        .from(users)
        .where(eq(users.id, grp.createdByUserId))
        .limit(1),
      db
        .select({
          userId: groupMembers.userId,
          joinedAt: groupMembers.joinedAt,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImage: users.profileImage,
        })
        .from(groupMembers)
        .innerJoin(users, eq(groupMembers.userId, users.id))
        .where(eq(groupMembers.groupId, gid))
        .orderBy(asc(groupMembers.joinedAt)),
    ])

    // msgRows already arrive ascending (the full-open fetch reversed newest-200
    // above), so the client can append them directly.
    res.json({
      group: {
        id: grp.id,
        name: grp.name,
        createdBy: creatorRows.length ? profileOf(creatorRows[0]) : null,
        createdByUserId: grp.createdByUserId,
        mine: grp.createdByUserId === me,
        memberCount: memberCountRows[0]?.n ?? 0,
        updatedAt: grp.updatedAt,
      },
      members: memberRows.map((r) => profileOf(r)),
      messages: msgRows,
    })
  } catch (err) {
    console.error("Failed to load group thread:", err)
    res.status(500).json({ error: "Failed to load group thread" })
  }
})

// ---- Send a message (member) ----
router.post("/:id/messages", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const gid = paramStr(req.params.id)
    if (!gid || !UUID_RE.test(gid)) {
      return res.status(400).json({ error: "Invalid group id" })
    }
    if (!(await isMember(gid, me))) {
      return res.status(403).json({ error: "You're not a member of this group" })
    }
    const text = typeof req.body?.body === "string" ? req.body.body.trim() : ""
    if (!text) return res.status(400).json({ error: "Message is required" })
    if (text.length > MESSAGE_MAX) {
      return res.status(400).json({ error: "Message is too long" })
    }

    const [created] = await db
      .insert(groupMessages)
      .values({ groupId: gid, authorUserId: me, body: text })
      .returning({
        id: groupMessages.id,
        groupId: groupMessages.groupId,
        authorUserId: groupMessages.authorUserId,
        body: groupMessages.body,
        createdAt: groupMessages.createdAt,
      })

    await Promise.all([
      db.update(groups).set({ updatedAt: new Date() }).where(eq(groups.id, gid)),
      // Sending marks you read up to now (mirrors the DM composer).
      db
        .update(groupMembers)
        .set({ lastReadAt: new Date() })
        .where(and(eq(groupMembers.groupId, gid), eq(groupMembers.userId, me))),
    ])

    // Toast every OTHER member (best-effort; large groups may fan out).
    const others = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, gid), ne(groupMembers.userId, me)))
    await Promise.all(
      others.map((o) =>
        notify({
          recipientUserId: o.userId,
          actorUserId: me,
          type: "group_message",
          refId: gid,
          context: text.slice(0, 200),
        })
      )
    )

    res.status(201).json({ message: created })
  } catch (err) {
    console.error("Failed to send group message:", err)
    res.status(500).json({ error: "Failed to send group message" })
  }
})

// ---- Mark read (member) ----
router.post("/:id/read", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const gid = paramStr(req.params.id)
    if (!gid || !UUID_RE.test(gid)) {
      return res.status(400).json({ error: "Invalid group id" })
    }
    if (!(await isMember(gid, me))) {
      return res.status(403).json({ error: "You're not a member of this group" })
    }
    const now = new Date()
    await Promise.all([
      db
        .update(groupMembers)
        .set({ lastReadAt: now })
        .where(and(eq(groupMembers.groupId, gid), eq(groupMembers.userId, me))),
      db
        .update(notifications)
        .set({ readAt: now })
        .where(
          and(
            eq(notifications.recipientUserId, me),
            inArray(notifications.type, ["group_added", "group_message"]),
            eq(notifications.refId, gid),
            isNull(notifications.readAt)
          )
        ),
    ])
    res.json({ ok: true })
  } catch (err) {
    console.error("Failed to mark group read:", err)
    res.status(500).json({ error: "Failed to mark group read" })
  }
})

// ---- Add a member (creator) ----
router.post("/:id/members", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const gid = paramStr(req.params.id)
    const target = typeof req.body?.userId === "string" ? req.body.userId : null
    if (!gid || !UUID_RE.test(gid) || !target || !UUID_RE.test(target)) {
      return res.status(400).json({ error: "Invalid group or user id" })
    }
    const [grp] = await db
      .select({ name: groups.name, createdByUserId: groups.createdByUserId })
      .from(groups)
      .where(eq(groups.id, gid))
      .limit(1)
    if (!grp) return res.status(404).json({ error: "Group not found" })
    if (grp.createdByUserId !== me) {
      return res.status(403).json({ error: "Only the group creator can add members" })
    }

    const found = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, target))
      .limit(1)
    if (found.length === 0) {
      return res.status(400).json({ error: "User not found" })
    }

    const inserted = await db
      .insert(groupMembers)
      .values({ groupId: gid, userId: target })
      .onConflictDoNothing()
      .returning({ id: groupMembers.id })
    if (inserted.length > 0) {
      await notify({
        recipientUserId: target,
        actorUserId: me,
        type: "group_added",
        refId: gid,
        context: grp.name,
      })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error("Failed to add group member:", err)
    res.status(500).json({ error: "Failed to add group member" })
  }
})

// ---- Remove a member (creator) ----
router.delete("/:id/members/:userId", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const gid = paramStr(req.params.id)
    const target = paramStr(req.params.userId)
    if (!gid || !UUID_RE.test(gid) || !target || !UUID_RE.test(target)) {
      return res.status(400).json({ error: "Invalid group or user id" })
    }
    const [grp] = await db
      .select({ createdByUserId: groups.createdByUserId })
      .from(groups)
      .where(eq(groups.id, gid))
      .limit(1)
    if (!grp) return res.status(404).json({ error: "Group not found" })
    if (grp.createdByUserId !== me) {
      return res.status(403).json({ error: "Only the group creator can remove members" })
    }
    if (target === grp.createdByUserId) {
      return res.status(400).json({ error: "The creator can't be removed — delete the group instead" })
    }
    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, gid), eq(groupMembers.userId, target)))
    res.json({ ok: true })
  } catch (err) {
    console.error("Failed to remove group member:", err)
    res.status(500).json({ error: "Failed to remove group member" })
  }
})

// ---- Leave (any member, self) ----
router.post("/:id/leave", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const gid = paramStr(req.params.id)
    if (!gid || !UUID_RE.test(gid)) {
      return res.status(400).json({ error: "Invalid group id" })
    }
    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, gid), eq(groupMembers.userId, me)))
    res.json({ ok: true })
  } catch (err) {
    console.error("Failed to leave group:", err)
    res.status(500).json({ error: "Failed to leave group" })
  }
})

// ---- Delete the whole group (creator; cascades members + messages) ----
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const me = req.userId!
    const gid = paramStr(req.params.id)
    if (!gid || !UUID_RE.test(gid)) {
      return res.status(400).json({ error: "Invalid group id" })
    }
    const [grp] = await db
      .select({ createdByUserId: groups.createdByUserId })
      .from(groups)
      .where(eq(groups.id, gid))
      .limit(1)
    if (!grp) return res.status(404).json({ error: "Group not found" })
    if (grp.createdByUserId !== me) {
      return res.status(403).json({ error: "Only the group creator can delete the group" })
    }
    await db.delete(groups).where(eq(groups.id, gid))
    res.status(204).send()
  } catch (err) {
    console.error("Failed to delete group:", err)
    res.status(500).json({ error: "Failed to delete group" })
  }
})

export default router
