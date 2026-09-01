require("dotenv").config()
const postgres = require("postgres")
const sql = postgres(process.env.DATABASE_URL)

;(async () => {
  const G = "2798e78e-84c5-454a-b5d5-5b550f4338ff"
  // After the unlock POST, the recompute should refresh updated_at on every
  // stored ET row for this guest.
  const stale = await sql`SELECT count(*)::int AS n FROM place_exploration WHERE guest_id=${G} AND updated_at < now() - interval '30 seconds'`
  const total = await sql`SELECT count(*)::int AS n FROM place_exploration WHERE guest_id=${G}`
  const fresh = await sql`SELECT count(*)::int AS n FROM place_exploration WHERE guest_id=${G} AND updated_at >= now() - interval '30 seconds'`
  console.log("total rows:", total[0].n, "| fresh (<30s):", fresh[0].n, "| stale:", stale[0].n)
  await sql.end()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
