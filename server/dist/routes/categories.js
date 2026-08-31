import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { categories } from "../db/schema.js";
import { optionalAuth } from "../middleware/auth.js";
import { ensureGuestSession } from "../middleware/guest.js";
import { matchMapboxCategory } from "../lib/mapboxCategoryMatcher.js";
const router = Router();
router.use(optionalAuth, ensureGuestSession);
function ownerFilter(req) {
    if (req.userId)
        return eq(categories.userId, req.userId);
    return eq(categories.guestId, req.guestId);
}
const categorySchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    icons: z.array(z.string()).optional(),
});
// ---- GET all categories ----
router.get("/", async (req, res) => {
    const rows = await db.select().from(categories).where(ownerFilter(req));
    res.json({ categories: rows });
});
// ---- GET match preview (Step 4) ----
router.get("/match", async (req, res) => {
    const { name } = req.query;
    if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Missing name query parameter" });
    }
    try {
        const match = await matchMapboxCategory(name);
        res.json({ match });
    }
    catch (err) {
        console.error("Match error:", err);
        res.status(500).json({ error: "Failed to match category" });
    }
});
// ---- POST create category ----
router.post("/", async (req, res) => {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    // Match Mapbox category
    let mapboxCategory = null;
    let mapboxCategoryConfidence = null;
    try {
        const match = await matchMapboxCategory(parsed.data.name);
        if (match) {
            mapboxCategory = match.canonicalId;
            mapboxCategoryConfidence = match.confidence;
        }
    }
    catch (err) {
        console.warn("Mapbox match failed, continuing with null:", err);
        // don't fail the creation
    }
    const [category] = await db
        .insert(categories)
        .values({
        name: parsed.data.name,
        description: parsed.data.description,
        mapboxCategory,
        mapboxCategoryConfidence,
        icons: parsed.data.icons ?? [],
        userId: req.userId ?? null,
        guestId: req.userId ? null : req.guestId,
    })
        .returning();
    res.status(201).json({ category });
});
export default router;
