require("dotenv").config()
const postgres = require("postgres")
const sql = postgres(process.env.DATABASE_URL)

;(async () => {
  const G = "2798e78e-84c5-454a-b5d5-5b550f4338ff"
  const node = { placeId: "dd7c6474-55e5-4862-bf89-682ebe8cd910", explored: true, percent: 100 }

  console.log("--- exact equivalent of drizzle's guest-branch upsert ---")
  try {
    const r = await sql`
      INSERT INTO place_exploration (place_id, guest_id, explored, percent)
      VALUES (${node.placeId}, ${G}, ${node.explored}, ${node.percent})
      ON CONFLICT (place_id, guest_id) WHERE guest_id IS NOT NULL
      DO UPDATE SET explored = EXCLUDED.explored, percent = EXCLUDED.percent, updated_at = now()
      RETURNING place_id, explored, percent, updated_at
    `
    console.log("OK, row after upsert:", r[0])
  } catch (e) {
    console.error("FAILED:", e.message)
  }

  // Also test the same statement WITHOUT the WHERE (drizzle pre-fix behavior)
  console.log("--- without index predicate (pre-fix behavior) ---")
  try {
    const r2 = await sql`
      INSERT INTO place_exploration (place_id, guest_id, explored, percent)
      VALUES (${node.placeId}, ${G}, ${node.explored}, ${node.percent})
      ON CONFLICT (place_id, guest_id)
      DO UPDATE SET explored = EXCLUDED.explored, percent = EXCLUDED.percent, updated_at = now()
    `
    console.log("OK:", r2)
  } catch (e) {
    console.error("FAILED:", e.message)
  }

  await sql.end()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
