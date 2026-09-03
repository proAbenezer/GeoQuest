// routes/pins.ts
import { Router } from "express"
import { z } from "zod"
import { eq, and, inArray, desc } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "../db/index.ts"
import { pins, users, comments } from "../db/schema.ts"
import { optionalAuth } from "../middleware/auth.ts"
import { ensureGuestSession } from "../middleware/guest.ts"
import { contentAudienceFor } from "./community.ts"

const router = Router()

const pinSchema = z.object({
  name: z.string().min(1, "Name is required"),
  customName: z.string().nullable().optional(),
  description: z.string().min(1, "Description is required"),
  customDescription: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  latitude: z.number(),
  longitude: z.number(),
  categoryId: z.string().uuid().nullable().optional(),
  placeId: z.string().uuid(),
  visited: z.boolean().optional(),
  saved: z.boolean().optional(),
  visitDate: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  icons: z.array(z.string()).optional(),
  // 'public' = the owner's connections + followers can see & comment; absent
  // defaults to 'private' (owner-only). Guests are forced private in the route.
  visibility: z.enum(["public", "private"]).optional(),
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

// Public pins of my connections + the users I follow — the shared feed behind
// both the map's "Friends' pins" overlay and a profile's pins gallery. Only
// pins whose owner is in MY audience (mutual connection or someone I follow)
// are returned, so a stranger's public pins never leak. A guest has no social
// graph, so the feed is always empty for them.
//
// Query string:
//   ?ownerId=<uuid>  restrict to one owner's public pins (their profile page).
//                    Self is always allowed; anyone outside my audience gets [].
router.get("/public", async (req, res) => {
  try {
    if (!req.userId) return res.json({ pins: [], routePairs: [] })
    const me = req.userId

    // Which owner to show, if any.
    const ownerId = typeof req.query.ownerId === "string" ? req.query.ownerId : null
    let scope: string[]
    if (ownerId) {
      if (ownerId === me) {
        scope = [me]
      } else {
        const audience = await contentAudienceFor(me)
        if (!audience.includes(ownerId)) {
          return res.json({ pins: [], routePairs: [] })
        }
        scope = [ownerId]
      }
    } else {
      // Overlay: everyone whose public content I can see.
      scope = await contentAudienceFor(me)
    }
    if (scope.length === 0) return res.json({ pins: [], routePairs: [] })

    const startPin = alias(pins, "start_pin")
    const endPin = alias(pins, "end_pin")

    const rows = await db
      .select({
        pin: {
          id: pins.id,
          name: pins.name,
          customName: pins.customName,
          description: pins.description,
          latitude: pins.latitude,
          longitude: pins.longitude,
          categoryId: pins.categoryId,
          placeId: pins.placeId,
          visitDate: pins.visitDate,
          imageUrl: pins.imageUrl,
          icons: pins.icons,
          saved: pins.saved,
          visibility: pins.visibility,
          createdAt: pins.createdAt,
        },
        owner: {
          userId: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          profileImage: users.profileImage,
        },
      })
      .from(pins)
      .innerJoin(users, eq(pins.userId, users.id))
      .where(and(eq(pins.visibility, "public"), inArray(pins.userId, scope)))
      .orderBy(desc(pins.createdAt))

    // Public routes = a two-pin route whose endpoints are both public and owned
    // by the same visible owner. Route pairs are stored only as comment targets
    // (routeStartPinId/routeEndPinId), so they're enumerated from `comments`.
    const pinIds = rows.map((r) => r.pin.id)
    let routePairs: { startPinId: string; endPinId: string }[] = []
    if (pinIds.length > 0) {
      const pairs = await db
        .selectDistinct({
          startPinId: comments.routeStartPinId,
          endPinId: comments.routeEndPinId,
        })
        .from(comments)
        .innerJoin(startPin, eq(comments.routeStartPinId, startPin.id))
        .innerJoin(endPin, eq(comments.routeEndPinId, endPin.id))
        .where(
          and(
            inArray(comments.routeStartPinId, pinIds),
            inArray(comments.routeEndPinId, pinIds),
            eq(startPin.visibility, "public"),
            eq(endPin.visibility, "public"),
            eq(startPin.userId, endPin.userId)
          )
        )
      routePairs = pairs
        .filter((p): p is { startPinId: string; endPinId: string } =>
          Boolean(p.startPinId && p.endPinId)
        )
    }

    res.json({ pins: rows.map((r) => ({ ...r.pin, owner: r.owner })), routePairs })
  } catch (err) {
    console.error("Failed to load public pins:", err)
    res.status(500).json({ error: "Failed to load public pins" })
  }
})

router.post("/", async (req, res) => {
  const parsed = pinSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const isGuest = !req.userId
  const [pin] = await db
    .insert(pins)
    .values({
      ...parsed.data,
      // Guests have no followers, so a guest "public" pin could never surface —
      // force it private to keep the semantics honest.
      visibility: isGuest ? "private" : (parsed.data.visibility ?? "private"),
      userId: req.userId ?? null,
      guestId: isGuest ? req.guestId : null,
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
  const updates = { ...parsed.data }
  if (!req.userId) updates.visibility = "private"
  const [pin] = await db
    .update(pins)
    .set(updates)
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
