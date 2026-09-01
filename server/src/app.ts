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

// Origins that may call this API. Always includes the Vercel frontend and the
// local dev server; CLIENT_ORIGIN (if set on Render) is honored too, so a
// dashboard value can still add/remove an origin without a redeploy.
const allowedOrigins = [
  "http://localhost:5173",
  "https://geo-quest-jade.vercel.app",
  ...(process.env.CLIENT_ORIGIN ? [process.env.CLIENT_ORIGIN] : []),
]

app.use(
  cors({
    origin: allowedOrigins,
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
