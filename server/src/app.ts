import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import authRoutes from "./routes/auth.ts"
import pinsRouter from "./routes/pins.ts"
import districtsRouter from "./routes/districts.ts"

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
app.use("/districts", districtsRouter)

export default app
