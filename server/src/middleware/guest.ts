import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { db } from "../db/index.js"
import { guests } from "../db/schema.js"

const GUEST_JWT_SECRET = process.env.GUEST_JWT_SECRET || process.env.JWT_SECRET!
const GUEST_COOKIE_NAME = "guest_id"

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year — guest unlock progress should persist long-term
}

// Must run AFTER optionalAuth. If the request is already authenticated (req.userId set),
// this is a no-op — logged-in users never get a guest identity.
export async function ensureGuestSession(req: Request, res: Response, next: NextFunction) {
  if (req.userId) return next()

  const token = req.cookies?.[GUEST_COOKIE_NAME]

  if (token) {
    try {
      const payload = jwt.verify(token, GUEST_JWT_SECRET) as { guestId: string }
      req.guestId = payload.guestId
      return next()
    } catch {
      // invalid/expired — fall through and issue a fresh guest identity
    }
  }

  const [guest] = await db.insert(guests).values({}).returning({ id: guests.id })
  const newToken = jwt.sign({ guestId: guest.id }, GUEST_JWT_SECRET, { expiresIn: "365d" })
  res.cookie(GUEST_COOKIE_NAME, newToken, cookieOptions)
  req.guestId = guest.id
  next()
}
