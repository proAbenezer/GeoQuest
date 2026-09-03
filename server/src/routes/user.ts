// routes/user.ts
import { Router } from "express"
import { z } from "zod"
import { and, eq, ne, sql } from "drizzle-orm"
import { db } from "../db/index.js"
import { users, follows } from "../db/schema.js"
import { requireAuth } from "../middleware/auth.js"
import { relationTo } from "./community.js"
import { travelSummary } from "./stats.js"

const router = Router()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")

const updateProfileSchema = z.object({
  profileImage: z.string().url().optional(),
  bannerImage: z.string().url().optional(),
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  username: usernameSchema.optional(),
})

router.patch("/profile", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ error: "No fields to update" })
  }

  // Username is globally unique — reject if another account already owns it.
  if (parsed.data.username) {
    const existing = await db.query.users.findFirst({
      where: and(eq(users.username, parsed.data.username), ne(users.id, req.userId!)),
      columns: { id: true },
    })
    if (existing) {
      return res.status(409).json({ error: "That username is already taken" })
    }
  }

  const [user] = await db
    .update(users)
    .set(parsed.data)
    .where(eq(users.id, req.userId!))
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImage: users.profileImage,
      bannerImage: users.bannerImage,
    })

  res.json({ user })
})

// Public profile bundle for any registered user. Identity + travel stats are
// open to any logged-in viewer (per product decision); the user's PUBLIC pins/
// routes gallery is a separate call to GET /pins/public?ownerId=<id> and stays
// audience-gated (owner, connections, followers only). Guests get no profile.
router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const userId = req.params.userId
    if (!UUID_RE.test(userId)) {
      return res.status(400).json({ error: "Invalid user id" })
    }
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImage: users.profileImage,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    const me = req.userId!
    const [relation, stats, followerRows, followingRows] = await Promise.all([
      relationTo(me, userId),
      travelSummary({ userId }),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(follows)
        .where(eq(follows.followeeId, userId)),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(follows)
        .where(eq(follows.followerId, userId)),
    ])

    res.json({
      user,
      relation,
      followersCount: followerRows[0]?.n ?? 0,
      followingCount: followingRows[0]?.n ?? 0,
      stats,
    })
  } catch (err) {
    console.error("Failed to load public profile:", err)
    res.status(500).json({ error: "Failed to load public profile" })
  }
})

export default router
