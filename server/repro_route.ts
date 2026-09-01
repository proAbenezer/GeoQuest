import "dotenv/config"
import { recomputeAndPersistCountry } from "./src/routes/places.js"

;(async () => {
  const owner = { userId: undefined as string | undefined, guestId: "2798e78e-84c5-454a-b5d5-5b550f4338ff" }
  try {
    await recomputeAndPersistCountry("ET", owner)
    console.log("RECOMPUTE OK — rows should now be fresh")
  } catch (e) {
    console.error("RECOMPUTE FAILED:", e)
  }
  process.exit(0)
})()
