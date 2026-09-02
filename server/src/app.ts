import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import authRoutes from "./routes/auth.ts"
import pinsRouter from "./routes/pins.ts"
import placesRouter from "./routes/places.ts"
import categoriesRoutes from "./routes/categories.ts"
import uploadsRouter from "./routes/uploads.ts"
import recentlyVisitedRoutes from "./routes/recently-visited.ts"
import userRouter from "./routes/user.ts"
import commentsRouter from "./routes/comments.ts"
import statsRouter from "./routes/stats.ts"

const app = express()

const extraOrigins = (process.env.CLIENT_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

// Origins that may call this API. The frontend is hosted on Vercel, which gives
// the production site and every branch/preview deployment its own *.vercel.app
// subdomain — so allow the whole suffix rather than pinning one URL (previews
// get random subdomains and would otherwise be CORS-blocked, as seen with
// geo-quest-jnl9wyvqi-proabenezers-projects.vercel.app). The local dev server
// is included, and CLIENT_ORIGIN (comma-separated, set on Render) adds extra
// origins without a redeploy.
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = curl / server-to-server calls — always allowed.
      if (!origin) return callback(null, true)
      try {
        const { protocol, host } = new URL(origin)
        const allowed =
          (protocol === "https:" || protocol === "http:") &&
          (host === "localhost:5173" ||
            host.endsWith(".vercel.app") ||
            extraOrigins.some((o) => o === origin || o === `${protocol}//${host}`))
        callback(null, allowed)
      } catch {
        callback(null, false)
      }
    },
    credentials: true,
  })
)
app.use(express.json())
app.use(cookieParser())

app.get("/health", (_req, res) => res.json({ ok: true }))
app.use("/auth", authRoutes)
app.use("/pins", pinsRouter)
app.use("/places", placesRouter)
app.use("/categories", categoriesRoutes)
app.use("/uploads", uploadsRouter)
app.use("/recently-visited", recentlyVisitedRoutes)
app.use("/user", userRouter)
app.use("/comments", commentsRouter)
app.use("/stats", statsRouter)

export default app
