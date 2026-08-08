import "dotenv/config"
import { db } from "../db/index.js"
import { places, countryFetchStatus } from "../db/schema.js"
import { eq, sql } from "drizzle-orm"
import * as turf from "@turf/turf"
import countries from "i18n-iso-countries"
import enLocale from "i18n-iso-countries/langs/en.json" with { type: "json" }

countries.registerLocale(enLocale)

type GBMetaEntry = {
  boundaryISO: string
  boundaryType: string // "ADM0", "ADM1", "ADM2", ...
  simplifiedGeometryGeoJSON: string
}

type GBFeature = {
  type: "Feature"
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown }
  properties: {
    shapeID: string
    shapeName: string
    shapeGroup: string
    shapeType: string
  }
}

type GBFeatureCollection = {
  type: "FeatureCollection"
  features: GBFeature[]
}

async function main() {
  const iso2 = process.argv[2]
  const force = process.argv.includes("--force")

  if (!iso2) {
    console.error("Usage: tsx src/scripts/fetchCountry.ts <ISO2 country code> [--force]")
    process.exit(1)
  }

  const iso3 = countries.alpha2ToAlpha3(iso2.toUpperCase())
  if (!iso3) {
    console.error(`"${iso2}" is not a recognized ISO2 country code.`)
    process.exit(1)
  }

  // Bail early if already cached, unless forced
  const [existingStatus] = await db
    .select()
    .from(countryFetchStatus)
    .where(eq(countryFetchStatus.countryCode, iso2.toUpperCase()))

  if (existingStatus?.status === "cached" && !force) {
    console.log(`${iso2.toUpperCase()} is already cached. Use --force to re-fetch.`)
    process.exit(0)
  }

  await db
    .insert(countryFetchStatus)
    .values({
      countryCode: iso2.toUpperCase(),
      status: "fetching",
      requestedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: countryFetchStatus.countryCode,
      set: { status: "fetching", requestedAt: new Date(), errorMessage: null },
    })

  try {
    console.log(`Fetching admin-level metadata for ${iso2.toUpperCase()} (${iso3})...`)

    const metaRes = await fetch(
      `https://www.geoboundaries.org/api/current/gbOpen/${iso3}/ALL/`
    )
    if (!metaRes.ok) {
      throw new Error(`geoBoundaries metadata request failed: ${metaRes.status}`)
    }
    const metadata: GBMetaEntry[] = await metaRes.json()

    if (!metadata.length) {
      throw new Error(`geoBoundaries has no data for ${iso3}`)
    }

    // Sort ascending: ADM0 first, then ADM1, ADM2... so parents exist
    // in the DB before we try to spatially match children to them.
    metadata.sort((a, b) => {
      const levelA = parseInt(a.boundaryType.replace("ADM", ""), 10)
      const levelB = parseInt(b.boundaryType.replace("ADM", ""), 10)
      return levelA - levelB
    })

    // Keep each level's inserted rows in memory (id + turf geometry) so the
    // next level down can test containment against them without re-querying.
    let previousLevelRows: { id: string; geom: turf.Feature }[] = []

    for (const level of metadata) {
      const adminLevel = parseInt(level.boundaryType.replace("ADM", ""), 10)

      if (!level.simplifiedGeometryGeoJSON) {
        console.warn(`No simplified geometry URL for ${level.boundaryType}, skipping.`)
        continue
      }

      console.log(`Fetching ${level.boundaryType} geometry...`)
      const geoRes = await fetch(level.simplifiedGeometryGeoJSON)
      if (!geoRes.ok) {
        throw new Error(`Failed to fetch ${level.boundaryType} geometry: ${geoRes.status}`)
      }
      const featureCollection: GBFeatureCollection = await geoRes.json()

      const currentLevelRows: { id: string; geom: turf.Feature }[] = []

      for (const feature of featureCollection.features) {
        let parentId: string | null = null

        if (adminLevel > 0 && previousLevelRows.length > 0) {
          const centroid = turf.centroid(feature as turf.Feature)
          const parentMatch = previousLevelRows.find((parent) =>
            turf.booleanPointInPolygon(centroid, parent.geom as any)
          )
          parentId = parentMatch?.id ?? null
        }

        const [inserted] = await db
          .insert(places)
          .values({
            name: feature.properties.shapeName,
            adminLevel,
            levelType: level.boundaryType, // "ADM0", "ADM1", "ADM2"...
            parentId,
            countryCode: iso2.toUpperCase(),
            shapeId: feature.properties.shapeID,
            boundary: sql`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(
              feature.geometry
            )}), 4326))`,
          })
          .onConflictDoUpdate({
            target: places.shapeId,
            set: {
              name: feature.properties.shapeName,
              parentId,
              boundary: sql`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(
                feature.geometry
              )}), 4326))`,
            },
          })
          .returning({ id: places.id })

        currentLevelRows.push({ id: inserted.id, geom: feature as turf.Feature })
      }

      console.log(`  Inserted/updated ${currentLevelRows.length} ${level.boundaryType} places.`)
      previousLevelRows = currentLevelRows
    }

    await db
      .update(countryFetchStatus)
      .set({ status: "cached", completedAt: new Date() })
      .where(eq(countryFetchStatus.countryCode, iso2.toUpperCase()))

    console.log(`${iso2.toUpperCase()} fully cached.`)
    process.exit(0)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Failed fetching ${iso2.toUpperCase()}:`, message)

    await db
      .update(countryFetchStatus)
      .set({ status: "failed", errorMessage: message })
      .where(eq(countryFetchStatus.countryCode, iso2.toUpperCase()))

    process.exit(1)
  }
}

main()
