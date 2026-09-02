import "dotenv/config"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import * as schema from "./schema.js"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Configure it under Render → Web Service → Environment " +
      "(use your Postgres service's Internal Database URL)."
  )
}

// Log the host we're really connecting to (credentials stripped) so a deploy log
// makes a misconfigured DATABASE_URL obvious — e.g. it should show a
// *.render.com host, never "localhost". Use hostname (not host): host already
// includes the port, so host + a separate `:${port}` would double-print it.
try {
  const { protocol, hostname, port, pathname } = new URL(connectionString)
  const suffix = port ? `:${port}` : ""
  console.log(`[db] connecting to ${protocol}//${hostname}${suffix}${pathname}`)
} catch {
  console.warn("[db] DATABASE_URL is not a valid URL")
}

// Render's External Database URL appends ?sslmode=require, which postgres.js does
// not read on its own — translate it into the ssl option. Local dev URLs and
// Render Internal URLs (no sslmode) connect without SSL and are unaffected.
let ssl: false | { rejectUnauthorized: false } = false
try {
  const mode = new URL(connectionString).searchParams.get("sslmode")
  if (mode && mode !== "disable") ssl = { rejectUnauthorized: false }
} catch {
  // invalid URL — let postgres.js report its own error below
}

const client = postgres(connectionString, ssl ? { ssl } : {})

export const db = drizzle(client, { schema })
