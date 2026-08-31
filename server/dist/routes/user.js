// routes/user.ts
import { Router } from "express";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router();
const usernameSchema = z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");
const updateProfileSchema = z.object({
    profileImage: z.string().url().optional(),
    bannerImage: z.string().url().optional(),
    firstName: z.string().min(1, "First name is required").optional(),
    lastName: z.string().min(1, "Last name is required").optional(),
    username: usernameSchema.optional(),
});
router.patch("/profile", requireAuth, async (req, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    if (Object.keys(parsed.data).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
    }
    // Username is globally unique — reject if another account already owns it.
    if (parsed.data.username) {
        const existing = await db.query.users.findFirst({
            where: and(eq(users.username, parsed.data.username), ne(users.id, req.userId)),
            columns: { id: true },
        });
        if (existing) {
            return res.status(409).json({ error: "That username is already taken" });
        }
    }
    const [user] = await db
        .update(users)
        .set(parsed.data)
        .where(eq(users.id, req.userId))
        .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImage: users.profileImage,
        bannerImage: users.bannerImage,
    });
    res.json({ user });
});
export default router;
