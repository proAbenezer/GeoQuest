import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { optionalAuth } from "../middleware/auth.ts";
import { ensureGuestSession } from "../middleware/guest.ts";
const isCloudinaryConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
    Boolean(process.env.CLOUDINARY_API_KEY) &&
    Boolean(process.env.CLOUDINARY_API_SECRET) &&
    process.env.CLOUDINARY_API_KEY !== "your_api_key";
if (isCloudinaryConfigured) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
}
else {
    // TODO: swap in real Cloudinary credentials in .env once the service
    // is reachable again / you can log in to grab them. Until then, uploads
    // are disabled but the rest of the app (pins without photos) works fine.
    console.warn("[uploads] Cloudinary is not configured — image uploads are disabled until CLOUDINARY_* env vars are set.");
}
const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cap
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed"));
        }
        cb(null, true);
    },
});
router.use(optionalAuth, ensureGuestSession);
router.post("/", upload.single("image"), async (req, res) => {
    if (!isCloudinaryConfigured) {
        return res.status(503).json({
            error: "Image upload is temporarily unavailable. You can still create the pin without a photo.",
        });
    }
    if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
    }
    try {
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({ folder: "geoquest/pins" }, (err, result) => {
                if (err || !result)
                    return reject(err);
                resolve(result);
            });
            stream.end(req.file.buffer);
        });
        res.status(201).json({ url: result.secure_url });
    }
    catch (err) {
        console.error("Cloudinary upload failed:", err);
        res.status(500).json({ error: "Image upload failed" });
    }
});
export default router;
