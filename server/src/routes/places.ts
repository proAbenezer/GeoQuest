// src/routes/places.ts
import { Router } from "express"
import { z } from "zod"
import { eq, and, isNull, sql } from "drizzle-orm"
import { db } from "../db/index.js"
import { places, countryFetchStatus, unlockedPlaces } from "../db/schema.js"
import { optionalAuth } from "../middleware/auth.js"
import { ensureGuestSession } from "../middleware/guest.js" // match your actual filename
import { fetchCountryBoundaries } from "../services/fetchCountryBoundaries.js"

const router = Router()

router.use(optionalAuth, ensureGuestSession)

function ownerFilter(req: { userId?: string; guestId?: string }) {
  if (req.userId) return eq(unlockedPlaces.userId, req.userId)
  return eq(unlockedPlaces.guestId, req.guestId!)
}

// GET /places/country/:iso2
// Returns the full cached place tree for a country (flat list — frontend
// walks parent_id itself, per the client-side hierarchy design).
// If uncached, kicks off the fetch in the background and returns status
// immediately — matches the "draw nothing + toast" UX.
router.get("/country/:iso2", async (req, res) => {
  const iso2 = req.params.iso2.toUpperCase()

  const [status] = await db
    .select()
    .from(countryFetchStatus)
    .where(eq(countryFetchStatus.countryCode, iso2))

  if (!status || status.status === "not_cached" || status.status === "failed") {
    // Fire and forget — do NOT await. Errors are caught and recorded
    // inside fetchCountryBoundaries itself (sets status to "failed").
    fetchCountryBoundaries(iso2).catch(() => {
      // already logged into country_fetch_status; nothing else to do here
    })
    return res.json({ status: "fetching", places: [] })
  }

  if (status.status === "fetching") {
    return res.json({ status: "fetching", places: [] })
  }

  // status.status === "cached"
  const countryPlaces = await db
    .select({
      id: places.id,
      name: places.name,
      adminLevel: places.adminLevel,
      levelType: places.levelType,
      parentId: places.parentId,
      countryCode: places.countryCode,
      boundary: sql<string>`ST_AsGeoJSON(${places.boundary})`,
    })
    .from(places)
    .where(eq(places.countryCode, iso2))

  res.json({ status: "cached", places: countryPlaces })
})

// POST /places/unlock
// Body: { placeId, latitude, longitude }
// Verifies the given GPS point actually falls inside the target place's
// boundary (server-side, via PostGIS — never trust a client-reported unlock),
// and that the target is a leaf place (has no children), since only leaf
// places unlock directly. Ancestor "unlocked" state is derived, not stored.
const unlockSchema = z.object({
  placeId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
})

router.post("/unlock", async (req, res) => {
  const parsed = unlockSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const { placeId, latitude, longitude } = parsed.data

  const [target] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.id, placeId))

  if (!target) {
    return res.status(404).json({ error: "Place not found" })
  }

  const [child] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.parentId, placeId))
    .limit(1)

  if (child) {
    return res.status(400).json({ error: "Only leaf-level places can be unlocked directly" })
  }

  const [containsResult] = await db.execute<{ contains: boolean }>(sql`
    SELECT ST_Contains(
      boundary,
      ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
    ) AS contains
    FROM places
    WHERE id = ${placeId}
  `)

  if (!containsResult?.contains) {
    return res.status(400).json({ error: "You are not currently inside this place" })
  }

  const [unlock] = await db
    .insert(unlockedPlaces)
    .values({
      placeId,
      userId: req.userId ?? null,
      guestId: req.userId ? null : req.guestId,
    })
    .onConflictDoNothing() // unique guards handle the "already unlocked" case silently
    .returning()

  res.status(201).json({ unlock: unlock ?? { placeId, alreadyUnlocked: true } })
})

// GET /places/unlocked
// Returns the leaf place IDs unlocked by the current identity (user or guest).
// Frontend combines this with its cached country tree to derive ancestor
// unlock states client-side (walking parent_id, per the design).
router.get("/unlocked", async (req, res) => {
  const unlocked = await db
    .select({ placeId: unlockedPlaces.placeId, unlockedAt: unlockedPlaces.unlockedAt })
    .from(unlockedPlaces)
    .where(ownerFilter(req))

  res.json({ unlocked })
})

router.get("/unlocked-countries", async (req, res) => {
  const rows = await db
    .selectDistinct({ countryCode: places.countryCode })
    .from(unlockedPlaces)
    .innerJoin(places, eq(unlockedPlaces.placeId, places.id))
    .where(ownerFilter(req))

  res.json({ countryCodes: rows.map((r) => r.countryCode) })
})

export default router
