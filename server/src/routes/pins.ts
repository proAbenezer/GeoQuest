import { Router } from "express"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { db } from "../db/index.js"
import { pins } from "../db/schema.js"
import { requireAuth } from "../middleware/auth.js"

const router = Router()

const pinSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  notes: z.string().nullable().optional(),
  latitude: z.number(),
  longitude: z.number(),
  categoryId: z.string().uuid().nullable().optional(),
  visited: z.boolean().optional(),
  saved: z.boolean().optional(),
  visitDate: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
})

const pinUpdateSchema = pinSchema.partial()

// Every route below requires a valid session.
router.use(requireAuth)

router.get("/", async (req, res) => {
  const userPins = await db.query.pins.findMany({
    where: eq(pins.userId, req.userId!),
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
    .values({ ...parsed.data, userId: req.userId! })
    .returning()
  res.status(201).json({ pin })
})

router.patch("/:id", async (req, res) => {
  const parsed = pinUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  // Ownership check — confirms the pin exists AND belongs to this user
  // before touching it. Without the userId clause, anyone could patch
  // any pin id.
  const existing = await db.query.pins.findFirst({
    where: and(eq(pins.id, req.params.id), eq(pins.userId, req.userId!)),
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
    where: and(eq(pins.id, req.params.id), eq(pins.userId, req.userId!)),
  })
  if (!existing) {
    return res.status(404).json({ error: "Pin not found" })
  }
  await db.delete(pins).where(eq(pins.id, req.params.id))
  res.status(204).send()
})

export default router
