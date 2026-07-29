import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET!

declare global {
  namespace Express {
    interface Request {
      userId?: string
      guestId?: string
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" })
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string }
    req.userId = payload.userId
    next()
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" })
  }
}

// Like requireAuth, but never blocks the request — just attaches req.userId if a valid token exists.
// Used on routes that behave differently for logged-in vs. guest users, rather than requiring login.
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.token
  if (!token) return next()
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string }
    req.userId = payload.userId
  } catch {
    // invalid/expired token — treat as logged out, don't block
  }
  next()
}
