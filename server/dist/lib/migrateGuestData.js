// lib/migrateGuestData.ts
// Reassigns rows created under a guest session to an authenticated user,
// so guest history (pins, categories, unlock progress, recently visited)
// survives the guest → account transition.
//
// guestId is KEPT on migrated rows (not nulled out), matching the existing
// signup behavior — a reclaimed row ends up with BOTH userId and guestId set,
// keeping the guest history visible/auditable.
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { categories, pins, recentlyVisited, unlockedPlaces } from "../db/schema.js";
export async function migrateGuestData(userId, guestId) {
    // Categories & pins have no per-user unique constraint — direct reassign.
    await db
        .update(categories)
        .set({ userId })
        .where(and(eq(categories.guestId, guestId), isNull(categories.userId)));
    await db
        .update(pins)
        .set({ userId })
        .where(and(eq(pins.guestId, guestId), isNull(pins.userId)));
    // unlockedPlaces & recentlyVisited each have a unique (placeId, userId)
    // index, so first drop guest rows that would collide with rows the user
    // already owns, then reassign the rest.
    await migrateUniquePlaceTable(unlockedPlaces, userId, guestId);
    await migrateUniquePlaceTable(recentlyVisited, userId, guestId);
}
async function migrateUniquePlaceTable(table, userId, guestId) {
    const userPlaceIds = db
        .select({ placeId: table.placeId })
        .from(table)
        .where(and(eq(table.userId, userId), isNull(table.guestId)));
    // Drop only the guest rows that duplicate a place the user already owns.
    await db
        .delete(table)
        .where(and(eq(table.guestId, guestId), inArray(table.placeId, userPlaceIds)));
    await db
        .update(table)
        .set({ userId })
        .where(and(eq(table.guestId, guestId), isNull(table.userId)));
}
