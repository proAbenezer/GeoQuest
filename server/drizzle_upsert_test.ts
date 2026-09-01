import "dotenv/config"
import { db } from "./src/db/index.js"
import { placeExploration } from "./src/db/schema.js"
import { sql } from "drizzle-orm"

// Reproduce the exact upsert the route runs (guest branch) for a row that
// already exists, to see whether drizzle's composed SQL fails.
;(async () => {
  const owner = { userId: undefined as string | undefined, guestId: "2798e78e-84c5-454a-b5d5-5b550f4338ff" }
  const node = { placeId: "dd7c6474-55e5-4862-bf89-682ebe8cd910", explored: true, percent: 100 }
  const values = {
    placeId: node.placeId,
    userId: owner.userId ?? null,
    guestId: owner.userId ? null : (owner.guestId ?? null),
    explored: node.explored,
    percent: node.percent,
  }
  try {
    const res = await db
      .insert(placeExploration)
      .values(values)
      .onConflictDoUpdate({
        target: [placeExploration.placeId, placeExploration.guestId],
        targetWhere: sql`${placeExploration.guestId} IS NOT NULL`,
        set: { explored: node.explored, percent: node.percent, updatedAt: new Date() },
      })
      .returning()
    console.log("DRIZZLE UPSERT OK:", res[0].explored, res[0].percent)
  } catch (e) {
    console.error("DRIZZLE UPSERT FAILED:", (e as Error).message)
  }
  process.exit(0)
})()
