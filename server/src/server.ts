import "dotenv/config"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { eq, sql } from "drizzle-orm"
import app from "./app.js"
import { db } from "./db/index.js"
import { countryFetchStatus } from "./db/schema.js"

const port = process.env.PORT ? Number(process.env.PORT) : 4000

async function start() {
  // NODE_ENV gates cookie behavior (SameSite/Secure) — log it so a deploy log
  // makes it obvious when Render hasn't set production (cookies would fall back
  // to the lax/local-dev flavor and break cross-site sessions).
  console.log(`[env] NODE_ENV=${process.env.NODE_ENV ?? "(unset)"}`)

  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Add it under Render → your web service → Environment " +
        "(use the Postgres service's Internal Database URL). Refusing to start."
    )
    process.exit(1)
  }

  // The place schema stores boundaries as PostGIS geometry(...) columns, so the
  // extension must exist before Drizzle can create those tables. IF NOT EXISTS
  // keeps this a cheap no-op on databases that already have it (e.g. local dev).
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS postgis`)
    console.log("PostGIS extension ensured")
  } catch (error) {
    console.error(
      "Failed to enable PostGIS — check that DATABASE_URL is reachable and the user owns the database.",
      error
    )
    process.exit(1)
  }

  // Apply pending schema migrations before accepting traffic. Render's build
  // step never compiles or runs drizzle-kit, so this is the only place the
  // migrations are guaranteed to run on every deploy. No-op once applied
  // (drizzle tracks them in its own table), so repeated boots are safe.
  try {
    await migrate(db, { migrationsFolder: "./drizzle" })
    console.log("Database migrations applied")
  } catch (error) {
    console.error("Database migration failed — refusing to start.", error)
    process.exit(1)
  }

  // --- Boot-time DB maintenance (best-effort; never block startup) ---
  // 1) A country left in "fetching" by a process that crashed mid-import would
  //    otherwise stay that way forever (GET /places/country returns [] and the
  //    frontend polls indefinitely). A freshly booted single instance has no
  //    in-flight imports, so reset any such rows so the next request re-triggers
  //    the fetch instead of treating the country as permanently unavailable.
  // 2) Lookup indexes on places.country_code / places.parent_id. Postgres does
  //    NOT auto-index FK columns, so these two drive the hot read/write paths
  //    (per-country tree fetches and the parent→children walks in the
  //    exploration roll-up) with seq-scans as more countries get cached. They
  //    are created here with IF NOT EXISTS rather than in a drizzle migration
  //    and deliberately NOT declared in schema.ts, so a future `db:generate`
  //    won't try to recreate them. Repeated boots are a cheap catalog no-op.
  try {
    await db
      .update(countryFetchStatus)
      .set({ status: "not_cached" })
      .where(eq(countryFetchStatus.status, "fetching"))
    console.log("Reset stale country fetch states")

    await db.execute(sql`CREATE INDEX IF NOT EXISTS "places_country_code_idx" ON "places" USING btree ("country_code")`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "places_parent_id_idx" ON "places" USING btree ("parent_id")`)
    console.log("Ensured places lookup indexes")
  } catch (error) {
    console.error("Boot-time DB maintenance failed:", error)
  }

  app.listen(port, () => {
    console.log(`GeoQuest server listening on http://localhost:${port}`)
  })
}

start()
