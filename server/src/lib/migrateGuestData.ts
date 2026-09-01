// lib/migrateGuestData.ts
// Reassigns rows created under a guest session to an authenticated user, so
// guest history (pins, categories, unlock progress, exploration roll-ups,
// travel stats, recently visited) fully survives the guest → account transition.
//
// guestId is NULLED on every migrated row (guest attribution is cleared) — the
// rows belong entirely to the account after signup. Guest rows that collide
// with data the account already owns are dropped first so the partial unique
// indexes never throw during reassignment.
import { and, eq, inArray, isNull } from "drizzle-orm"
import { db } from "../db/index.js"
import {
  categories,
  pins,
  placeExploration,
  recentlyVisited,
  travelStats,
  unlockedPlaces,
} from "../db/schema.js"

export async function migrateGuestData(userId: string, guestId: string) {
  // Categories & pins have no per-user unique constraint — direct reassign.
  await db
    .update(categories)
    .set({ userId, guestId: null })
    .where(and(eq(categories.guestId, guestId), isNull(categories.userId)))

  await db
    .update(pins)
    .set({ userId, guestId: null })
    .where(and(eq(pins.guestId, guestId), isNull(pins.userId)))

  // unlockedPlaces, placeExploration & recentlyVisited are each unique on
  // (placeId, userId); travelStats is unique on (userId, countryCode). For
  // each, first drop guest rows that would collide with rows the user already
  // owns, then reassign the rest and clear the guestId.
  await migratePlaceKeyedTable(unlockedPlaces, userId, guestId)
  await migratePlaceKeyedTable(placeExploration, userId, guestId)
  await migratePlaceKeyedTable(recentlyVisited, userId, guestId)
  await migrateCountryKeyedTable(travelStats, userId, guestId)
}

type PlaceKeyedTable = typeof unlockedPlaces | typeof placeExploration | typeof recentlyVisited

async function migratePlaceKeyedTable(table: PlaceKeyedTable, userId: string, guestId: string) {
  const userPlaceIds = db
    .select({ placeId: table.placeId })
    .from(table)
    .where(and(eq(table.userId, userId), isNull(table.guestId)))

  // Drop only the guest rows that duplicate a place the user already owns.
  await db
    .delete(table)
    .where(and(eq(table.guestId, guestId), inArray(table.placeId, userPlaceIds)))

  await db
    .update(table)
    .set({ userId, guestId: null })
    .where(and(eq(table.guestId, guestId), isNull(table.userId)))
}

async function migrateCountryKeyedTable(table: typeof travelStats, userId: string, guestId: string) {
  const userCountryCodes = db
    .select({ countryCode: table.countryCode })
    .from(table)
    .where(and(eq(table.userId, userId), isNull(table.guestId)))

  // Drop only the guest rows that duplicate a country the user already owns.
  await db
    .delete(table)
    .where(and(eq(table.guestId, guestId), inArray(table.countryCode, userCountryCodes)))

  await db
    .update(table)
    .set({ userId, guestId: null })
    .where(and(eq(table.guestId, guestId), isNull(table.userId)))
}
