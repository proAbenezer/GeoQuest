require("dotenv").config()
const postgres = require("postgres")
const sql = postgres(process.env.DATABASE_URL)

;(async () => {
  const G = "2798e78e-84c5-454a-b5d5-5b550f4338ff"
  const rows = await sql`SELECT explored, percent, (now() - updated_at)::interval AS age FROM place_exploration WHERE guest_id=${G} ORDER BY updated_at DESC LIMIT 3`
  console.log("most recently updated rows (should be ~seconds old if DO UPDATE ran):")
  rows.forEach((r) => console.log("  explored:", r.explored, "| percent:", r.percent, "| age:", r.age))

  const stale = await sql`SELECT count(*)::int AS n FROM place_exploration WHERE guest_id=${G} AND updated_at < now() - interval '1 minute'`
  console.log("rows older than 1 minute (should be 0):", stale[0].n)
  await sql.end()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
