require("dotenv").config()
const postgres = require("postgres")
const sql = postgres(process.env.DATABASE_URL)

;(async () => {
  const G = "2798e78e-84c5-454a-b5d5-5b550f4338ff"
  const total = await sql`SELECT count(*)::int AS n FROM place_exploration WHERE guest_id=${G}`
  const updated = await sql`SELECT count(*)::int AS n, min(updated_at) AS min_ts, max(updated_at) AS max_ts, min(place_id) AS first_id FROM place_exploration WHERE guest_id=${G}`
  console.log("total:", total[0].n, "| range:", JSON.stringify(updated[0]))
  const sample = await sql`SELECT place_id, explored, percent, updated_at FROM place_exploration WHERE guest_id=${G} ORDER BY updated_at DESC LIMIT 1`
  console.log("newest row:", JSON.stringify(sample[0]))
  await sql.end()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
