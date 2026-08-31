// src/scripts/fetchCountry.ts
//
// Usage: tsx src/scripts/fetchCountry.ts <ISO2 country code> [--force]
import "dotenv/config";
import { db } from "../db/index.js";
import { countryFetchStatus } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { fetchCountryBoundaries } from "../services/fetchCountryBoundaries.js";
async function main() {
    const iso2 = process.argv[2];
    const force = process.argv.includes("--force");
    if (!iso2) {
        console.error("Usage: tsx src/scripts/fetchCountry.ts <ISO2 country code> [--force]");
        process.exit(1);
    }
    const [existingStatus] = await db
        .select()
        .from(countryFetchStatus)
        .where(eq(countryFetchStatus.countryCode, iso2.toUpperCase()));
    if (existingStatus?.status === "cached" && !force) {
        console.log(`${iso2.toUpperCase()} is already cached. Use --force to re-fetch.`);
        process.exit(0);
    }
    console.log(`Fetching ${iso2.toUpperCase()}...`);
    try {
        await fetchCountryBoundaries(iso2);
        console.log(`${iso2.toUpperCase()} fully cached.`);
        process.exit(0);
    }
    catch (err) {
        console.error(`Failed fetching ${iso2.toUpperCase()}:`, err instanceof Error ? err.message : err);
        process.exit(1);
    }
}
main();
