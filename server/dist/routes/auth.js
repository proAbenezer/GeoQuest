// routes/auth.ts
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { requireAuth, readExistingGuestId } from "../middleware/auth.js";
import { migrateGuestData } from "../lib/migrateGuestData.js";
const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
const GUEST_COOKIE_NAME = "guest_id";
const signupSchema = z.object({
    email: z.string().email(),
    username: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(20, "Username must be at most 20 characters")
        .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
});
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
router.post("/signup", async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { email, username, firstName, lastName, password } = parsed.data;
    const existingEmail = await db.query.users.findFirst({
        where: eq(users.email, email),
    });
    if (existingEmail) {
        return res.status(409).json({ error: "An account with that email already exists" });
    }
    const existingUsername = await db.query.users.findFirst({
        where: eq(users.username, username),
    });
    if (existingUsername) {
        return res.status(409).json({ error: "That username is already taken" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
        .insert(users)
        .values({ email, username, firstName, lastName, passwordHash })
        .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImage: users.profileImage,
        bannerImage: users.bannerImage,
    });
    // --- Reclaim guest history, if any ---
    // We keep guestId on these rows (not nulled out) so guest history stays
    // visible/auditable — a reclaimed row ends up with BOTH userId and guestId set.
    const guestId = readExistingGuestId(req);
    if (guestId) {
        // Reclaim pins, categories, unlock progress, and recently visited.
        await migrateGuestData(user.id, guestId);
        // Guest identity is no longer needed as an anonymous session —
        // the person is authenticated now. Clear the guest cookie.
        res.clearCookie(GUEST_COOKIE_NAME, cookieOptions);
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, cookieOptions);
    res.status(201).json({ user });
});
router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { email, password } = parsed.data;
    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, cookieOptions);
    // Reclaim any guest history from this browser (pins, categories, unlock
    // progress, recently visited), then drop the guest session — the person
    // is authenticated now.
    const guestId = readExistingGuestId(req);
    if (guestId) {
        await migrateGuestData(user.id, guestId);
        res.clearCookie(GUEST_COOKIE_NAME, cookieOptions);
    }
    res.json({
        user: {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImage: user.profileImage,
            bannerImage: user.bannerImage,
        },
    });
});
router.get("/me", requireAuth, async (req, res) => {
    const user = await db.query.users.findFirst({
        where: eq(users.id, req.userId),
        columns: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            bannerImage: true,
        },
    });
    res.json({ user });
});
router.post("/logout", (_req, res) => {
    res.clearCookie("token", cookieOptions);
    res.status(204).send();
});
export default router;
