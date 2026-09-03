// src/routes/stats.ts
//
// Travel-stats dashboard read side (item 14). Reads the MATERIALIZED per-user
// summary (travel_stats) — the dashboard never scans the raw check-in log in
// steady state. A legacy identity (unlocks that predate travel_stats) is
// backfilled once on first load, mirroring the /places/exploration pattern.
//
// Response shape:
//   summary.countriesVisited | totalPlaces | totalDays (global distinct local
//     days, so the same day in two countries counts once) | firstVisitAt |
//     lastVisitAt
//   countries[]           — iso2, name, continent, places, days, first/last
//     visit, explorationPercent (the stored country-root roll-up from item 9)
//   streak                 — longest run of consecutive days in one country
//   categories[]           — identity's pins grouped by category (overall; pins
//     lack reliable country attribution, so not per-country)

import { Router } from "express"
import { eq, and, isNull, inArray } from "drizzle-orm"
import { db } from "../db/index.js"
import {
  places,
  unlockedPlaces,
  placeExploration,
  travelStats,
  pins,
  categories,
} from "../db/schema.js"
import { optionalAuth } from "../middleware/auth.js"
import { ensureGuestSession } from "../middleware/guest.js"
import { continentFor } from "../data/continents.js"
import { localDayFromUtc } from "./places.js"

const router = Router()

router.use(optionalAuth)
router.use(ensureGuestSession)

export type Owner = { userId?: string; guestId?: string }

function travelStatsFilter(owner: Owner) {
  if (owner.userId) return eq(travelStats.userId, owner.userId)
  return eq(travelStats.guestId, owner.guestId!)
}
function unlockedFilter(owner: Owner) {
  if (owner.userId) return eq(unlockedPlaces.userId, owner.userId)
  return eq(unlockedPlaces.guestId, owner.guestId!)
}
function pinsFilter(owner: Owner) {
  if (owner.userId) return eq(pins.userId, owner.userId)
  return eq(pins.guestId, owner.guestId!)
}

// Days since epoch for a YYYYMMDD int, so consecutive-day detection stays
// correct across month/year boundaries (20260930 → 20261001 must be adjacent).
function dayNumber(yyyymmdd: number): number {
  const y = Math.floor(yyyymmdd / 10000)
  const m = Math.floor((yyyymmdd % 10000) / 100)
  const d = yyyymmdd % 100
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

function longestStreak(days: number[]): number {
  const sorted = [...new Set(days)].map(dayNumber).sort((a, b) => a - b)
  let best = 0
  let run = 0
  let prev = Number.NaN
  for (const d of sorted) {
    run = run > 0 && d === prev + 1 ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return best
}

type BackfillAggregate = {
  countryCode: string
  countryName: string
  placeIds: Set<string>
  days: Set<number>
  firstVisitAt: Date
  lastVisitAt: Date
}

// One-time legacy backfill: the identity has check-ins (unlockedPlaces) but no
// travel_stats rows yet. Scan the raw log once, bucket into the same per-country
// aggregates the write path maintains, persist, and return the rows.
async function backfillTravelStats(owner: Owner) {
  const unlockRows = await db
    .select({
      placeId: unlockedPlaces.placeId,
      unlockedAt: unlockedPlaces.unlockedAt,
      timezoneOffsetMinutes: unlockedPlaces.timezoneOffsetMinutes,
    })
    .from(unlockedPlaces)
    .where(unlockedFilter(owner))
  if (unlockRows.length === 0) return []

  const placeIds = unlockRows.map((r) => r.placeId)
  const placeRows = await db
    .select({ id: places.id, countryCode: places.countryCode })
    .from(places)
    .where(inArray(places.id, placeIds))
  const countryByPlace = new Map(placeRows.map((p) => [p.id, p.countryCode]))

  const countryCodes = Array.from(new Set(placeRows.map((p) => p.countryCode)))
  const rootRows = await db
    .select({ countryCode: places.countryCode, name: places.name })
    .from(places)
    .where(and(inArray(places.countryCode, countryCodes), isNull(places.parentId)))
  const rootNameByIso2 = new Map(rootRows.map((r) => [r.countryCode, r.name]))

  const aggregates = new Map<string, BackfillAggregate>()
  for (const u of unlockRows) {
    const countryCode = countryByPlace.get(u.placeId)
    if (!countryCode) continue
    let agg = aggregates.get(countryCode)
    if (!agg) {
      agg = {
        countryCode,
        countryName: rootNameByIso2.get(countryCode) ?? countryCode,
        placeIds: new Set(),
        days: new Set(),
        firstVisitAt: u.unlockedAt,
        lastVisitAt: u.unlockedAt,
      }
      aggregates.set(countryCode, agg)
    }
    agg.placeIds.add(u.placeId)
    agg.days.add(localDayFromUtc(u.unlockedAt.getTime(), u.timezoneOffsetMinutes ?? 0))
    if (u.unlockedAt < agg.firstVisitAt) agg.firstVisitAt = u.unlockedAt
    if (u.unlockedAt > agg.lastVisitAt) agg.lastVisitAt = u.unlockedAt
  }

  const values = Array.from(aggregates.values()).map((a) => ({
    userId: owner.userId ?? null,
    guestId: owner.userId ? null : (owner.guestId ?? null),
    countryCode: a.countryCode,
    countryName: a.countryName,
    placesCount: a.placeIds.size,
    days: Array.from(a.days).sort((x, y) => x - y),
    firstVisitAt: a.firstVisitAt,
    lastVisitAt: a.lastVisitAt,
  }))

  if (values.length) {
    await db.insert(travelStats).values(values).onConflictDoNothing()
  }
  return db.select().from(travelStats).where(travelStatsFilter(owner))
}

// Lightweight travel KPIs for ONE identity — the top-line numbers the dashboard
// shows (countries, total places, global distinct days, streak). Used by both
// the owner's own /stats (via its inline fold) and the PUBLIC profile route
// (user.ts GET /user/:userId), so a viewer sees exactly what the owner sees.
// Backfills a legacy identity lazily, exactly like GET /stats.
export async function travelSummary(owner: Owner) {
  let rows = await db.select().from(travelStats).where(travelStatsFilter(owner))
  if (rows.length === 0) {
    rows = await backfillTravelStats(owner)
  }
  const globalDays = new Set<number>()
  let totalPlaces = 0
  let firstVisitAt: Date | null = null
  let lastVisitAt: Date | null = null
  let bestStreak = 0
  let bestStreakName: string | null = null
  for (const r of rows) {
    for (const d of r.days) globalDays.add(d)
    totalPlaces += r.placesCount
    if (r.firstVisitAt && (!firstVisitAt || r.firstVisitAt < firstVisitAt)) {
      firstVisitAt = r.firstVisitAt
    }
    if (r.lastVisitAt && (!lastVisitAt || r.lastVisitAt > lastVisitAt)) {
      lastVisitAt = r.lastVisitAt
    }
    const streak = longestStreak(r.days)
    if (streak > bestStreak) {
      bestStreak = streak
      bestStreakName = r.countryName
    }
  }
  return {
    countriesVisited: rows.length,
    totalPlaces,
    totalDays: globalDays.size,
    firstVisitAt,
    lastVisitAt,
    longestStreakDays: bestStreak,
    streakCountry: bestStreakName,
  }
}

router.get("/", async (req, res) => {
  try {
    const owner: Owner = { userId: req.userId, guestId: req.userId ? undefined : req.guestId }

    let rows = await db.select().from(travelStats).where(travelStatsFilter(owner))
    if (rows.length === 0) {
      rows = await backfillTravelStats(owner)
    }

    // Exploration % per country: the stored country-root roll-up (item 9).
    const iso2s = rows.map((r) => r.countryCode)
    const rootRows = iso2s.length
      ? await db
          .select({ id: places.id, countryCode: places.countryCode })
          .from(places)
          .where(and(inArray(places.countryCode, iso2s), isNull(places.parentId)))
      : []
    const rootIdByIso2 = new Map(rootRows.map((r) => [r.countryCode, r.id]))
    const rootIds = Array.from(rootIdByIso2.values())
    const explRows = rootIds.length
      ? await db
          .select({ placeId: placeExploration.placeId, percent: placeExploration.percent })
          .from(placeExploration)
          .where(
            and(
              owner.userId
                ? eq(placeExploration.userId, owner.userId)
                : eq(placeExploration.guestId, owner.guestId!),
              inArray(placeExploration.placeId, rootIds)
            )
          )
      : []
    const explByIso2 = new Map<string, number | null>()
    for (const e of explRows) {
      for (const [iso2, id] of rootIdByIso2) {
        if (id === e.placeId) explByIso2.set(iso2, e.percent)
      }
    }

    // Category breakdown (overall).
    const pinRows = await db
      .select({ categoryId: pins.categoryId, categoryName: categories.name })
      .from(pins)
      .leftJoin(categories, eq(pins.categoryId, categories.id))
      .where(pinsFilter(owner))
    const catCounts = new Map<string, { name: string; count: number }>()
    for (const p of pinRows) {
      const key = p.categoryId ?? "uncategorized"
      const existing = catCounts.get(key)
      catCounts.set(key, {
        name: p.categoryName ?? "Uncategorized",
        count: (existing?.count ?? 0) + 1,
      })
    }
    const categoriesArr = Array.from(catCounts.values()).sort((a, b) => b.count - a.count)

    // Per-country rows + global aggregates.
    const globalDays = new Set<number>()
    let totalPlaces = 0
    let firstVisitAt: Date | null = null
    let lastVisitAt: Date | null = null
    let bestStreak = 0
    let bestStreakIso2: string | null = null
    let bestStreakName: string | null = null
    let bestStreakContinent: string | null = null

    const countries = rows.map((r) => {
      for (const d of r.days) globalDays.add(d)
      totalPlaces += r.placesCount
      if (r.firstVisitAt && (!firstVisitAt || r.firstVisitAt < firstVisitAt)) {
        firstVisitAt = r.firstVisitAt
      }
      if (r.lastVisitAt && (!lastVisitAt || r.lastVisitAt > lastVisitAt)) {
        lastVisitAt = r.lastVisitAt
      }
      const streak = longestStreak(r.days)
      if (streak > bestStreak) {
        bestStreak = streak
        bestStreakIso2 = r.countryCode
        bestStreakName = r.countryName
        bestStreakContinent = continentFor(r.countryCode)
      }
      return {
        iso2: r.countryCode,
        name: r.countryName,
        continent: continentFor(r.countryCode),
        places: r.placesCount,
        days: r.days.length,
        firstVisitAt: r.firstVisitAt,
        lastVisitAt: r.lastVisitAt,
        explorationPercent: explByIso2.get(r.countryCode) ?? null,
      }
    })

    res.json({
      summary: {
        countriesVisited: rows.length,
        totalPlaces,
        totalDays: globalDays.size,
        firstVisitAt,
        lastVisitAt,
      },
      countries,
      streak:
        bestStreak > 0
          ? {
              longestDays: bestStreak,
              iso2: bestStreakIso2,
              name: bestStreakName,
              continent: bestStreakContinent,
            }
          : null,
      categories: categoriesArr,
    })
  } catch (err) {
    console.error("Failed to load stats:", err)
    res.status(500).json({ error: "Failed to load stats" })
  }
})

export default router
