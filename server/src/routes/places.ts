// src/routes/places.ts
import { Router } from "express"
import { z } from "zod"
import { eq, and, isNull, sql, inArray } from "drizzle-orm"
import { db } from "../db/index.js"
import { places, countryFetchStatus, unlockedPlaces, placeExploration, travelStats } from "../db/schema.js"
import { optionalAuth } from "../middleware/auth.js"
import { ensureGuestSession } from "../middleware/guest.js" // match your actual filename
import { fetchCountryBoundaries } from "../services/fetchCountryBoundaries.js"

const router = Router()

router.use(optionalAuth, ensureGuestSession)

function ownerFilter(req: { userId?: string; guestId?: string }) {
  if (req.userId) return eq(unlockedPlaces.userId, req.userId)
  return eq(unlockedPlaces.guestId, req.guestId!)
}

// Same owner filter but scoped to `place_exploration` rows (the leaf-unlock
// filter above can't be reused — its column belongs to `unlocked_places`).
function explorationOwnerFilter(owner: { userId?: string; guestId?: string }) {
  if (owner.userId) return eq(placeExploration.userId, owner.userId)
  return eq(placeExploration.guestId, owner.guestId!)
}

// ---------------------------------------------------------------------------
// Exploration roll-up
//
// The unlock logic decides which LEAF divisions a user has physically visited
// (unlockedPlaces). A place's explored state is the bottom-up roll-up of those
// leaves, computed generically at every level of the hierarchy — no hardcoded
// depth:
//   - leaf:            explored = placeId is in the identity's unlocked set.
//   - internal place:  explored = every direct child is explored;
//                      percent  = explored children weighted by each child's
//                      geographic area (places.area, m²) — a large explored
//                      district counts for more than a tiny one. Falls back to
//                      child-count weighting when areas are unavailable
//                      (pre-backfill).
// Write path: POST /places/unlock refreshes ONLY the unlocked leaf's ancestor
// chain (refreshAncestors, O(depth)) instead of recomputing the whole country,
// persisting each changed node immediately so a read never rebuilds hierarchy.
// Legacy unlock progress that predates this feature is backfilled once on first
// read (see /exploration).
// ---------------------------------------------------------------------------

type Owner = { userId?: string; guestId?: string }
type ExplorationNode = { placeId: string; explored: boolean; percent: number }

async function computeCountryExploration(
  countryCode: string,
  owner: Owner
): Promise<Map<string, ExplorationNode>> {
  const countryPlaces = await db
    .select({ id: places.id, parentId: places.parentId, area: places.area })
    .from(places)
    .where(eq(places.countryCode, countryCode))

  const unlockedRows = await db
    .select({ placeId: unlockedPlaces.placeId })
    .from(unlockedPlaces)
    .where(ownerFilter(owner))

  const unlocked = new Set(unlockedRows.map((r) => r.placeId))

  const children = new Map<string, string[]>()
  const idSet = new Set(countryPlaces.map((p) => p.id))
  const areaById = new Map<string, number | null>()
  for (const p of countryPlaces) {
    if (p.parentId && idSet.has(p.parentId)) {
      const arr = children.get(p.parentId) ?? []
      arr.push(p.id)
      children.set(p.parentId, arr)
    }
    areaById.set(p.id, p.area)
  }

  const result = new Map<string, ExplorationNode>()

  const visit = (id: string): ExplorationNode => {
    const existing = result.get(id)
    if (existing) return existing
    const kids = children.get(id) ?? []
    if (kids.length === 0) {
      const explored = unlocked.has(id)
      const node = { placeId: id, explored, percent: explored ? 100 : 0 }
      result.set(id, node)
      return node
    }
    const childNodes = kids.map(visit)
    const percent = weightedPercent(
      childNodes.map((c) => ({ explored: c.explored, area: areaById.get(c.placeId) ?? null }))
    )
    const node = { placeId: id, explored: childNodes.every((c) => c.explored), percent }
    result.set(id, node)
    return node
  }

  // Roots are places with no parent inside the country (the top-level place,
  // plus any orphaned rows whose parent was never imported).
  for (const p of countryPlaces) {
    if (!p.parentId || !idSet.has(p.parentId)) visit(p.id)
  }

  return result
}

async function upsertExploration(node: ExplorationNode, owner: Owner) {
  const values = {
    placeId: node.placeId,
    userId: owner.userId ?? null,
    guestId: owner.userId ? null : (owner.guestId ?? null),
    explored: node.explored,
    percent: node.percent,
  }
  // Exactly one of userId/guestId is set, so target the matching partial index.
  // The partial unique indexes need their WHERE predicate repeated in the
  // conflict target (`targetWhere`) for Postgres index inference to match.
  if (owner.userId) {
    await db
      .insert(placeExploration)
      .values(values)
      .onConflictDoUpdate({
        target: [placeExploration.placeId, placeExploration.userId],
        targetWhere: sql`${placeExploration.userId} IS NOT NULL`,
        set: { explored: node.explored, percent: node.percent, updatedAt: new Date() },
      })
  } else {
    await db
      .insert(placeExploration)
      .values(values)
      .onConflictDoUpdate({
        target: [placeExploration.placeId, placeExploration.guestId],
        targetWhere: sql`${placeExploration.guestId} IS NOT NULL`,
        set: { explored: node.explored, percent: node.percent, updatedAt: new Date() },
      })
  }
}

// Weighted child aggregation for a node's percentage. Each child contributes
// proportionally to its geographic area (m²); when no areas are present
// (pre-backfill) it degrades to plain child-count weighting. A parent is only
// "explored" when every child is explored — full coverage is still required.
function weightedPercent(
  children: { explored: boolean; area: number | null }[]
): number {
  let exploredWeight = 0
  let totalWeight = 0
  for (const c of children) {
    const w = c.area ?? 0
    totalWeight += w
    if (c.explored) exploredWeight += w
  }
  if (totalWeight > 0) return Math.round((exploredWeight / totalWeight) * 100)
  if (children.length === 0) return 0
  const exploredCount = children.filter((c) => c.explored).length
  return Math.round((exploredCount / children.length) * 100)
}

// Incremental roll-up after a leaf unlock: touch ONLY the ancestor chain
// (O(depth), typically 3-6 hops), recomputing each node from its DIRECT
// children's stored flags. Stops as soon as a node's values are unchanged —
// nothing above it can change either. Mirrors computeCountryExploration's math,
// scoped to one branch. Callers treat failures as best-effort.
async function refreshAncestors(leafPlaceId: string, owner: Owner): Promise<void> {
  await upsertExploration({ placeId: leafPlaceId, explored: true, percent: 100 }, owner)

  let currentId: string | null = leafPlaceId
  let guard = 0
  while (currentId && guard++ < 64) {
    const [current] = await db
      .select({ parentId: places.parentId })
      .from(places)
      .where(eq(places.id, currentId))
    const parentId = current?.parentId
    if (!parentId) break // reached the country root

    const childrenRows = await db
      .select({ id: places.id, area: places.area, explored: placeExploration.explored })
      .from(places)
      .leftJoin(
        placeExploration,
        and(
          eq(placeExploration.placeId, places.id),
          owner.userId
            ? eq(placeExploration.userId, owner.userId)
            : eq(placeExploration.guestId, owner.guestId!)
        )
      )
      .where(eq(places.parentId, parentId))

    const percent = weightedPercent(
      childrenRows.map((c) => ({ explored: c.explored ?? false, area: c.area }))
    )
    const explored = childrenRows.length > 0 && childrenRows.every((c) => c.explored)
    const node: ExplorationNode = { placeId: parentId, explored, percent }

    const [stored] = await db
      .select({ explored: placeExploration.explored, percent: placeExploration.percent })
      .from(placeExploration)
      .where(and(explorationOwnerFilter(owner), eq(placeExploration.placeId, parentId)))
    if (stored && stored.explored === node.explored && stored.percent === node.percent) break

    await upsertExploration(node, owner)
    currentId = parentId
  }
}

// Local calendar day (YYYYMMDD int) for a UTC instant, given the traveler's
// offset from UTC in minutes. Folding the offset in BEFORE reading the UTC
// getters computes the correct wall-clock date in that offset's timezone
// regardless of the server's own timezone (a JS Date's local getters would use
// the server's tz instead). Exported for the stats route's legacy backfill.
export function localDayFromUtc(utcMs: number, offsetMinutes: number): number {
  const d = new Date(utcMs + offsetMinutes * 60000)
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

// Incremental materialized-summary update (travel_stats) after a check-in.
// Runs at write time so GET /stats never scans the raw check-in log. The local
// day is added on ANY check-in (a re-unlock on a new day is still a day of
// presence); placesCount grows only on a FRESH unlock. First/last visit track
// the min/max timestamps. Best-effort — callers must not fail the unlock.
async function updateTravelStats(
  placeId: string,
  alreadyUnlocked: boolean,
  offsetMinutes: number,
  owner: Owner
): Promise<void> {
  const [leaf] = await db
    .select({ countryCode: places.countryCode })
    .from(places)
    .where(eq(places.id, placeId))
  if (!leaf) return

  const [root] = await db
    .select({ name: places.name })
    .from(places)
    .where(and(eq(places.countryCode, leaf.countryCode), isNull(places.parentId)))
    .limit(1)
  const countryName = root?.name ?? leaf.countryCode

  const rowFilter = and(
    owner.userId ? eq(travelStats.userId, owner.userId) : eq(travelStats.guestId, owner.guestId!),
    eq(travelStats.countryCode, leaf.countryCode)
  )
  const [existing] = await db.select().from(travelStats).where(rowFilter).limit(1)

  const now = new Date()
  const day = localDayFromUtc(now.getTime(), offsetMinutes)
  const days = new Set(existing?.days ?? [])
  days.add(day)

  const firstVisitAt = existing?.firstVisitAt
    ? new Date(Math.min(new Date(existing.firstVisitAt).getTime(), now.getTime()))
    : now

  // placesCount on a NEW row is derived from the identity's actual unlocks in
  // this country rather than starting at 0: a legacy identity's first
  // post-upgrade check-in is often a RE-unlock (alreadyUnlocked=true), which
  // would otherwise bake a 0-count into the row forever (GET /stats only lazy-
  // backfills when the identity has NO travel_stats rows at all). Existing rows
  // just increment on fresh unlocks; the local day is added on any check-in.
  let placesCount = existing?.placesCount ?? 0
  if (!existing) {
    const [cnt] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(unlockedPlaces)
      .innerJoin(places, eq(unlockedPlaces.placeId, places.id))
      .where(
        and(
          owner.userId
            ? eq(unlockedPlaces.userId, owner.userId)
            : eq(unlockedPlaces.guestId, owner.guestId!),
          eq(places.countryCode, leaf.countryCode)
        )
      )
    placesCount = cnt?.count ?? 0
  } else if (!alreadyUnlocked) {
    placesCount += 1
  }

  const values = {
    userId: owner.userId ?? null,
    guestId: owner.userId ? null : (owner.guestId ?? null),
    countryCode: leaf.countryCode,
    countryName,
    placesCount,
    days: Array.from(days).sort((a, b) => a - b),
    firstVisitAt,
    lastVisitAt: now,
  }

  if (existing) {
    await db
      .update(travelStats)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(travelStats.id, existing.id))
  } else {
    await db.insert(travelStats).values(values)
  }
}

async function recomputeAndPersistCountry(countryCode: string, owner: Owner) {
  const nodes = await computeCountryExploration(countryCode, owner)
  for (const node of nodes.values()) {
    await upsertExploration(node, owner)
  }
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
      // 6-decimal precision (~11 cm) is far below GPS error and the stored
      // geometry is untouched — only the bytes sent over the wire shrink.
      boundary: sql<string>`ST_AsGeoJSON(${places.boundary}, 6)`,
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
// places unlock directly. Ancestor exploration state is derived and persisted
// below via refreshAncestors (see the "Exploration roll-up" block).
const unlockSchema = z.object({
  placeId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  // Minutes to ADD to UTC to get the traveler's local time (east positive),
  // sent by the client as -getTimezoneOffset(). Buckets "distinct calendar
  // days" in the traveler's own timezone. Defaults to 0 (UTC) when absent.
  timezoneOffsetMinutes: z.number().int().min(-840).max(840).optional().default(0),
})

router.post("/unlock", async (req, res) => {
  const parsed = unlockSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const { placeId, latitude, longitude, timezoneOffsetMinutes } = parsed.data

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
      timezoneOffsetMinutes,
    })
    .onConflictDoNothing() // unique guards handle the "already unlocked" case silently
    .returning()

  const alreadyUnlocked = !unlock
  res.status(201).json({ unlock: unlock ?? { placeId, alreadyUnlocked: true } })

  // Refresh the exploration roll-up along the leaf's ancestor chain only
  // (O(depth), not O(country)). This is the single update path for derived
  // exploration state. Best-effort: a failure here must never fail the unlock
  // itself — the leaf stays unlocked and the next unlock (or the legacy
  // backfill in /exploration) recomputes.
  try {
    const owner: Owner = { userId: req.userId, guestId: req.userId ? undefined : req.guestId }
    await refreshAncestors(placeId, owner)
  } catch (err) {
    console.error("Failed to refresh exploration after unlock:", err)
  }

  // Incrementally update the materialized travel summary (travel_stats) so the
  // stats dashboard never scans the raw check-in log. Also best-effort.
  try {
    const owner: Owner = { userId: req.userId, guestId: req.userId ? undefined : req.guestId }
    await updateTravelStats(placeId, alreadyUnlocked, timezoneOffsetMinutes, owner)
  } catch (err) {
    console.error("Failed to update travel stats after unlock:", err)
  }
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

// GET /places/exploration?iso2=ET
// Returns the identity's persisted per-node exploration roll-up (explored +
// percent) for one country — the read side of the exploration bar. The frontend
// never recomputes the hierarchy itself.
// Legacy data: unlock progress that predates this feature has no roll-up rows.
// If the identity has unlocks here but no stored rows, we compute and persist
// the country once (a one-time backfill — the ongoing update path stays
// write-time in /unlock).
router.get("/exploration", async (req, res) => {
  const iso2 = String(req.query.iso2 ?? "").toUpperCase()
  if (!iso2) {
    return res.status(400).json({ error: "iso2 query param is required" })
  }
  const owner: Owner = { userId: req.userId, guestId: req.userId ? undefined : req.guestId }

  const [status] = await db
    .select()
    .from(countryFetchStatus)
    .where(eq(countryFetchStatus.countryCode, iso2))

  // Only meaningful once the country's boundary tree is cached.
  if (!status || status.status !== "cached") {
    return res.json({ entries: [] })
  }

  const countryPlaces = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.countryCode, iso2))
  const countryIds = countryPlaces.map((p) => p.id)
  if (countryIds.length === 0) {
    return res.json({ entries: [] })
  }

  const selectStored = () =>
    db
      .select({
        placeId: placeExploration.placeId,
        explored: placeExploration.explored,
        percent: placeExploration.percent,
      })
      .from(placeExploration)
      .where(and(explorationOwnerFilter(owner), inArray(placeExploration.placeId, countryIds)))

  let entries = await selectStored()

  if (entries.length === 0) {
    const [unlockedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(unlockedPlaces)
      .where(and(ownerFilter(owner), inArray(unlockedPlaces.placeId, countryIds)))
    if (Number(unlockedCount?.count ?? 0) > 0) {
      await recomputeAndPersistCountry(iso2, owner)
      entries = await selectStored()
    }
  }

  res.json({ entries })
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
