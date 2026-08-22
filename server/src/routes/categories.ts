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

// ✅ Add mapboxCategory (optional, string) to the schema
const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  mapboxCategory: z.string().optional(), // new field
})

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
      name: parsed.data.name,
      description: parsed.data.description,
      mapboxCategory: parsed.data.mapboxCategory ?? null, // if omitted, store null
      userId: req.userId ?? null,
      guestId: req.userId ? null : req.guestId,
    })
    .returning()
  res.status(201).json({ category })
})

export default router
