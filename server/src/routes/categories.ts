import { Router } from "express"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { categories } from "../db/schema.js"
import { optionalAuth } from "../middleware/auth.js"
import { ensureGuestSession } from "../middleware/guest.js"

const router = Router()
router.use(optionalAuth, ensureGuestSession)

function ownerFilter(req: { userId?: string; guestId?: string }) {
  if (req.userId) return eq(categories.userId, req.userId)
  return eq(categories.guestId, req.guestId!)
}

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
})

// Returns whatever categories this identity has — empty array for a
// brand-new guest/user, by design. No auto-seeding.
router.get("/", async (req, res) => {
  const rows = await db.select().from(categories).where(ownerFilter(req))
  res.json({ categories: rows })
})

router.post("/", async (req, res) => {
  const parsed = categorySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const [category] = await db
    .insert(categories)
    .values({
      ...parsed.data,
      userId: req.userId ?? null,
      guestId: req.userId ? null : req.guestId,
    })
    .returning()
  res.status(201).json({ category })
})

export default router
