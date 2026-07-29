import { Router } from "express"
import { z } from "zod"
import { sql, and, eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { districts, unlockedDistricts } from "../db/schema.js"
import { optionalAuth } from "../middleware/auth.js"
import { ensureGuestSession } from "../middleware/guest.js"

const router = Router()

const unlockSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})


router.get("/", optionalAuth, ensureGuestSession, async (req, res) => {
  const identityCheck = req.userId
    ? sql`ud.user_id = ${req.userId}`
    : sql`ud.guest_id = ${req.guestId}`

  const result = await db.execute(sql`
    SELECT
      d.id,
      d.name,
      ST_AsGeoJSON(d.boundary) as geojson,
      EXISTS (
        SELECT 1 FROM unlocked_districts ud
        WHERE ud.district_id = d.id AND ${identityCheck}
      ) as unlocked
    FROM districts d
  `)
  const rows = Array.isArray(result) ? result : (result as any).rows

  res.json({
    type: "FeatureCollection",
    features: rows.map((r: any) => ({
      type: "Feature",
      id: r.id,
      properties: { id: r.id, name: r.name, unlocked: r.unlocked },
      geometry: JSON.parse(r.geojson),
    })),
  })
})
router.post("/unlock", optionalAuth, ensureGuestSession, async (req, res) => {
  const parsed = unlockSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const { latitude, longitude } = parsed.data

  const pointGeoJson = JSON.stringify({
    type: "Point",
    coordinates: [longitude, latitude], // GeoJSON is [lng, lat], not [lat, lng]
  })

  const result = await db.execute(sql`
    SELECT id, name FROM districts
    WHERE ST_Contains(boundary, ST_GeomFromGeoJSON(${pointGeoJson}))
    LIMIT 1
  `)
  const rows = Array.isArray(result) ? result : (result as any).rows
  const district = rows[0] as { id: string; name: string } | undefined

  if (!district) {
    return res.json({ unlocked: false, reason: "No imported district covers this location yet" })
  }

  const identityFilter = req.userId
    ? eq(unlockedDistricts.userId, req.userId)
    : eq(unlockedDistricts.guestId, req.guestId!)

  const existing = await db.query.unlockedDistricts.findFirst({
    where: and(eq(unlockedDistricts.districtId, district.id), identityFilter),
  })

  if (existing) {
    return res.json({ unlocked: true, alreadyUnlocked: true, district })
  }

  await db.insert(unlockedDistricts).values({
    districtId: district.id,
    userId: req.userId ?? null,
    guestId: req.userId ? null : req.guestId,
  })

  res.json({ unlocked: true, alreadyUnlocked: false, district })
})

// Fetch everything this identity has unlocked so far — used to render the fog-of-war overlay
router.get("/unlocked", optionalAuth, ensureGuestSession, async (req, res) => {
  const identityFilter = req.userId
    ? eq(unlockedDistricts.userId, req.userId)
    : eq(unlockedDistricts.guestId, req.guestId!)

  const unlocked = await db.query.unlockedDistricts.findMany({
    where: identityFilter,
    with: { district: true },
  })

  res.json({ unlocked })
})

export default router
