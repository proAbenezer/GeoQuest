import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
const GUEST_JWT_SECRET = process.env.GUEST_JWT_SECRET || process.env.JWT_SECRET;
const GUEST_COOKIE_NAME = "guest_id";
export function requireAuth(req, res, next) {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.userId = payload.userId;
        next();
    }
    catch {
        return res.status(401).json({ error: "Invalid or expired session" });
    }
}
// Like requireAuth, but never blocks the request — just attaches req.userId if a valid token exists.
// Used on routes that behave differently for logged-in vs. guest users, rather than requiring login.
export function optionalAuth(req, _res, next) {
    const token = req.cookies?.token;
    if (!token)
        return next();
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.userId = payload.userId;
    }
    catch {
        // invalid/expired token — treat as logged out, don't block
    }
    next();
}
// Reads an existing guest identity from the cookie WITHOUT creating a new one.
// Used only at signup, to check "did this browser already have guest history to reclaim,"
// since minting a fresh guest here would be pointless — the person is about to become a real user.
export function readExistingGuestId(req) {
    const token = req.cookies?.[GUEST_COOKIE_NAME];
    if (!token)
        return undefined;
    try {
        const payload = jwt.verify(token, GUEST_JWT_SECRET);
        return payload.guestId;
    }
    catch {
        return undefined;
    }
}
