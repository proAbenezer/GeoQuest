// routes/pins.ts
import { Router } from "express"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { db } from "../db/index.ts"
import { pins } from "../db/schema.ts"
import { optionalAuth } from "../middleware/auth.ts"
import { ensureGuestSession } from "../middleware/guest.ts"

const router = Router()

const pinSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  notes: z.string().nullable().optional(),
  latitude: z.number(),
  longitude: z.number(),
  categoryId: z.string().uuid().nullable().optional(),
  placeId: z.string().uuid().nullable().optional(),
  visited: z.boolean().optional(),
  saved: z.boolean().optional(),
  visitDate: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
})
const pinUpdateSchema = pinSchema.partial()

// Every route below works for BOTH logged-in users and guests.
// optionalAuth attaches req.userId if a real session exists; ensureGuestSession
// falls back to a guest identity (creating one if needed) only when req.userId is unset.
// After this chain, exactly one of req.userId / req.guestId is guaranteed to be set.
router.use(optionalAuth, ensureGuestSession)

// Builds the correct ownership filter depending on whether this request
// is from a logged-in user or a guest. Never both — a request is one or the other,
// even though a reclaimed DB row can have both columns populated.
function ownerFilter(req: { userId?: string; guestId?: string }) {
  if (req.userId) return eq(pins.userId, req.userId)
  return eq(pins.guestId, req.guestId!)
}

router.get("/", async (req, res) => {
  const userPins = await db.query.pins.findMany({
    where: ownerFilter(req),
  })
  res.json({ pins: userPins })
})

router.post("/", async (req, res) => {
  const parsed = pinSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const [pin] = await db
    .insert(pins)
    .values({
      ...parsed.data,
      userId: req.userId ?? null,
      guestId: req.userId ? null : req.guestId,
    })
    .returning()
  res.status(201).json({ pin })
})

router.patch("/:id", async (req, res) => {
  const parsed = pinUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  // Ownership check — confirms the pin exists AND belongs to this identity
  // before touching it. Without this clause, anyone could patch any pin id.
  const existing = await db.query.pins.findFirst({
    where: and(eq(pins.id, req.params.id), ownerFilter(req)),
  })
  if (!existing) {
    return res.status(404).json({ error: "Pin not found" })
  }
  const [pin] = await db
    .update(pins)
    .set(parsed.data)
    .where(eq(pins.id, req.params.id))
    .returning()
  res.json({ pin })
})

router.delete("/:id", async (req, res) => {
  const existing = await db.query.pins.findFirst({
    where: and(eq(pins.id, req.params.id), ownerFilter(req)),
  })
  if (!existing) {
    return res.status(404).json({ error: "Pin not found" })
  }
  await db.delete(pins).where(eq(pins.id, req.params.id))
  res.status(204).send()
})

export default router
