import "dotenv/config"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import app from "./app.js"
import { db } from "./db/index.js"

const port = process.env.PORT ? Number(process.env.PORT) : 4000

async function start() {
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

  app.listen(port, () => {
    console.log(`GeoQuest server listening on http://localhost:${port}`)
  })
}

start()
