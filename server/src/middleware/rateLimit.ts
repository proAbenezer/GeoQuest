// middleware/rateLimit.ts
// Tiered per-IP rate limiting.
//
// One dispatcher picks a single limiter per request based on route+method so
// rules never double-count (a request is counted once, against one tier):
//   POST /auth/login | /auth/signup                 -> 10/min  (brute force)
//   POST /community/conversations/:id/messages      -> 20/min  (message sends)
//   POST /comments* | /places/unlock                -> 30/min  (comments/unlocks)
//   everything else                                 -> 120/min (general cap)
//
// The store is in-memory (the express-rate-limit default), which is correct for
// the current single web-service deployment; a future multi-instance deploy
// would swap in a shared store (e.g. Redis). OPTIONS preflights and /health are
// never limited. Normal app behaviour sits far under every cap: unread-badge and
// inbox polling are GETs (~6/min each) against the general tier, and opening a
// thread polls GET /messages ~12/min — still well inside 120/min.
import { rateLimit } from "express-rate-limit"
import type { Request, Response, NextFunction } from "express"

const WINDOW_MS = 60_000 // 1 minute per tier

function makeLimiter(limit: number) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: true, // draft-6 style RateLimit-* headers
    legacyHeaders: false, // don't emit the deprecated X-RateLimit-* headers
    skip: (req: Request) => req.method === "OPTIONS",
    handler: (req: Request, res: Response) => {
      res.setHeader("Retry-After", String(Math.ceil(WINDOW_MS / 1000)))
      res.status(429).json({ error: "Too many requests — try again shortly" })
    },
  })
}

const authLimiter = makeLimiter(10)
const messageLimiter = makeLimiter(20)
const writeLimiter = makeLimiter(30)
const generalLimiter = makeLimiter(120)

// Which tier does this request belong to? Returns one of the four limiters, or
// null when the request should skip limiting entirely.
function pickLimiter(req: Request) {
  const { method, path } = req
  if (method === "OPTIONS" || path === "/health") return null

  if (method === "POST") {
    if (path === "/auth/login" || path === "/auth/signup") return authLimiter
    if (path.startsWith("/community/conversations/") && path.endsWith("/messages")) {
      return messageLimiter
    }
    if (path === "/places/unlock" || path === "/comments" || path.startsWith("/comments/")) {
      return writeLimiter
    }
  }

  return generalLimiter
}

export function tieredLimiter(req: Request, res: Response, next: NextFunction) {
  const limiter = pickLimiter(req)
  if (!limiter) return next()
  return limiter(req, res, next)
}
