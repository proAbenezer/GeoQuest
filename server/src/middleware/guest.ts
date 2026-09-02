import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { guests } from "../db/schema.js"

const GUEST_JWT_SECRET = process.env.GUEST_JWT_SECRET || process.env.JWT_SECRET!
const GUEST_COOKIE_NAME = "guest_id"

// Production serves the frontend from a different site (Vercel → Render), so the
// guest cookie must be SameSite=None; Secure to ride along on cross-site fetches.
// A Lax cookie is withheld by the browser on cross-site XHR, which would mint a
// new guest on every request and make unlock progress vanish. Local dev is
// same-site (localhost:5173 → localhost:4000), where Lax + http is correct.
const IS_PROD = process.env.NODE_ENV === "production"
const cookieOptions = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax",
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
      // Verify the guest still exists before trusting the JWT. A token whose
      // guest row was deleted (e.g. a DB wipe to test from scratch) is stale —
      // reuse would make FK writes fail silently. Fall through and mint a fresh
      // identity instead, mirroring the invalid/expired path below.
      const [existing] = await db
        .select({ id: guests.id })
        .from(guests)
        .where(eq(guests.id, payload.guestId))
        .limit(1)
      if (existing) {
        req.guestId = existing.id
        return next()
      }
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
