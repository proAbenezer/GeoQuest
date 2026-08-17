import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import authRoutes from "./routes/auth.ts"
import pinsRouter from "./routes/pins.ts"
import placesRouter from "./routes/places.ts"
import categoriesRoutes from "./routes/categories.ts"
import uploadsRouter from "./routes/uploads.ts"

const app = express()

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
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

export default app
