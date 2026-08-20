// routes/recently-visited.ts
import { Router } from "express"
import { z } from "zod"
import { eq, and, desc, sql } from "drizzle-orm"
import { db } from "../db/index.ts"
import { recentlyVisited, pins, places } from "../db/schema.ts"
import { optionalAuth } from "../middleware/auth.ts"
import { ensureGuestSession } from "../middleware/guest.ts"

const router = Router()

// ============================================
// SCHEMAS
// ============================================

const trackVisitedSchema = z.object({
  // ✅ FIX: was z.string().uuid() — rejected Mapbox's non-UUID place IDs
  // from reverse-geocode results (e.g. "mapbox_id" strings), causing every
  // map-click track call to fail with a 400.
  placeId: z.string().min(1, "placeId is required"),
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})

const updateRecentlyVisitedSchema = z.object({
  isPinned: z.boolean().optional(),
  pinId: z.string().uuid().nullable().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})

// ============================================
// MIDDLEWARE
// ============================================

// Every route below works for BOTH logged-in users and guests.
// optionalAuth attaches req.userId if a real session exists; ensureGuestSession
// falls back to a guest identity (creating one if needed) only when req.userId is unset.
// After this chain, exactly one of req.userId / req.guestId is guaranteed to be set.
router.use(optionalAuth)
router.use(ensureGuestSession)

// Builds the correct ownership filter depending on whether this request
// is from a logged-in user or a guest. Never both — a request is one or the other,
// even though a reclaimed DB row can have both columns populated.
function ownerFilter(req: { userId?: string; guestId?: string }) {
  if (req.userId) return eq(recentlyVisited.userId, req.userId)
  return eq(recentlyVisited.guestId, req.guestId!)
}

// ============================================
// GET /api/recently-visited
// Get all recently visited items (pins + unlocked places)
// ============================================
router.get("/", async (req, res) => {
  try {
    const userId = req.userId
    const guestId = req.guestId

    // 1. Get pinned places that are visited (from pins table)
    const pinnedVisited = await db
      .select({
        id: pins.id,
        placeId: pins.placeId,
        // ✅ FIX: `pins.customName || pins.name` compared two Drizzle column
        // *reference objects*, which are always truthy — so it silently always
        // picked customName, even when the user left it blank/null. COALESCE
        // runs per-row in SQL and correctly falls back to pins.name.
        name: sql<string>`COALESCE(${pins.customName}, ${pins.name})`,
        address: pins.description,
        latitude: pins.latitude,
        longitude: pins.longitude,
        visitedAt: pins.visitDate || pins.createdAt,
        isPin: sql<boolean>`true`,
        pinId: pins.id,
        type: sql<string>`'pin'`,
        categoryId: pins.categoryId,
        imageUrl: pins.imageUrl,
        visitCount: sql<number>`NULL`,
      })
      .from(pins)
      .where(
        userId
          ? and(eq(pins.userId, userId), eq(pins.visited, true))
          : and(eq(pins.guestId, guestId), eq(pins.visited, true))
      )
      .orderBy(desc(pins.visitDate))

    // 2. Get unlocked places that are NOT pinned yet (from recently_visited table)
    const unlockedNotPinned = await db
      .select({
        id: recentlyVisited.id,
        placeId: recentlyVisited.placeId,
        name: recentlyVisited.name,
        address: recentlyVisited.address,
        latitude: recentlyVisited.latitude,
        longitude: recentlyVisited.longitude,
        visitedAt: recentlyVisited.lastAccessedAt,
        isPin: sql<boolean>`false`,
        pinId: sql<string>`NULL`,
        type: sql<string>`'unlocked'`,
        categoryId: sql<string>`NULL`,
        imageUrl: sql<string>`NULL`,
        visitCount: recentlyVisited.visitCount,
      })
      .from(recentlyVisited)
      .where(
        and(
          ownerFilter(req),
          eq(recentlyVisited.isPinned, false)
        )
      )
      .orderBy(desc(recentlyVisited.lastAccessedAt))

    // 3. Combine and sort by most recent
    const combined = [...pinnedVisited, ...unlockedNotPinned]
      .sort((a, b) => {
        const dateA = new Date(a.visitedAt || 0).getTime()
        const dateB = new Date(b.visitedAt || 0).getTime()
        return dateB - dateA
      })
      .slice(0, 50)

    res.json({ items: combined })
  } catch (error) {
    console.error("Failed to get recently visited:", error)
    res.status(500).json({ error: "Failed to get recently visited items" })
  }
})

// ============================================
// POST /api/recently-visited
// Track a visited place
// ============================================
router.post("/", async (req, res) => {
  try {
    const parsed = trackVisitedSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }

    const { placeId, name, address, latitude, longitude } = parsed.data
    const userId = req.userId
    const guestId = req.guestId

    // Check if place exists in recently_visited table
    const existing = await db.query.recentlyVisited.findFirst({
      where: and(
        eq(recentlyVisited.placeId, placeId),
        userId
          ? eq(recentlyVisited.userId, userId)
          : eq(recentlyVisited.guestId, guestId)
      ),
    })

    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(recentlyVisited)
        .set({
          lastAccessedAt: new Date(),
          visitCount: (existing.visitCount || 0) + 1,
          latitude: latitude || existing.latitude,
          longitude: longitude || existing.longitude,
          address: address || existing.address,
          name: name || existing.name,
        })
        .where(eq(recentlyVisited.id, existing.id))
        .returning()

      return res.json({
        success: true,
        message: "Updated last accessed time",
        item: updated,
      })
    }

    // Create new record
    const [created] = await db
      .insert(recentlyVisited)
      .values({
        userId: userId ?? null,
        guestId: userId ? null : guestId,
        placeId,
        name,
        address: address || null,
        latitude: latitude || null,
        longitude: longitude || null,
        firstVisitedAt: new Date(),
        lastAccessedAt: new Date(),
        visitCount: 1,
        isPinned: false,
        autoTracked: true,
      })
      .returning()

    res.status(201).json({
      success: true,
      message: "Place tracked as visited",
      item: created,
    })
  } catch (error) {
    console.error("Failed to track visited place:", error)
    res.status(500).json({ error: "Failed to track visited place" })
  }
})

// ============================================
// PATCH /api/recently-visited/:id
// Mark a place as pinned
// ============================================
router.patch("/:id", async (req, res) => {
  try {
    const parsed = updateRecentlyVisitedSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }

    const { isPinned, pinId, address, latitude, longitude } = parsed.data

    // Ownership check
    const existing = await db.query.recentlyVisited.findFirst({
      where: and(eq(recentlyVisited.id, req.params.id), ownerFilter(req)),
    })

    if (!existing) {
      return res.status(404).json({ error: "Recently visited item not found" })
    }

    const updateData: any = {
      lastAccessedAt: new Date(),
    }

    if (isPinned !== undefined) updateData.isPinned = isPinned
    if (pinId !== undefined) updateData.pinId = pinId
    if (address !== undefined) updateData.address = address
    if (latitude !== undefined) updateData.latitude = latitude
    if (longitude !== undefined) updateData.longitude = longitude

    const [updated] = await db
      .update(recentlyVisited)
      .set(updateData)
      .where(eq(recentlyVisited.id, req.params.id))
      .returning()

    res.json({
      success: true,
      message: "Recently visited item updated",
      item: updated,
    })
  } catch (error) {
    console.error("Failed to update recently visited:", error)
    res.status(500).json({ error: "Failed to update recently visited" })
  }
})

// ============================================
// DELETE /api/recently-visited/:id
// Remove from recently visited
// ============================================
router.delete("/:id", async (req, res) => {
  try {
    // Ownership check
    const existing = await db.query.recentlyVisited.findFirst({
      where: and(eq(recentlyVisited.id, req.params.id), ownerFilter(req)),
    })

    if (!existing) {
      return res.status(404).json({ error: "Recently visited item not found" })
    }

    await db.delete(recentlyVisited).where(eq(recentlyVisited.id, req.params.id))

    res.status(204).send()
  } catch (error) {
    console.error("Failed to remove from recently visited:", error)
    res.status(500).json({ error: "Failed to remove from recently visited" })
  }
})

// ============================================
// GET /api/recently-visited/count
// Get the count of recently visited places
// ============================================
router.get("/count", async (req, res) => {
  try {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(recentlyVisited)
      .where(ownerFilter(req))

    res.json({ count: result[0]?.count || 0 })
  } catch (error) {
    console.error("Failed to get recently visited count:", error)
    res.status(500).json({ error: "Failed to get recently visited count" })
  }
})

export default router
