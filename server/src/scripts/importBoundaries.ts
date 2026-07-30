import "dotenv/config"
import { sql } from "drizzle-orm"
import { db } from "../db/index.js"
import { places } from "../db/schema.js"

const ISO3 = "ETH"
const COUNTRY_CODE = "ET"

type GBMeta = {
  boundaryID: string
  boundaryName: string
  simplifiedGeometryGeoJSON: string
}

async function fetchBoundaryMeta(iso3: string, level: "ADM0" | "ADM1" | "ADM2"): Promise<GBMeta> {
  const url = `https://www.geoboundaries.org/api/current/gbOpen/${iso3}/${level}/`
  const res = await fetch(url)
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Failed to fetch metadata for ${iso3} ${level}: ${res.status}\n${text.slice(0, 500)}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    console.error(`Metadata response was not valid JSON. URL: ${url}\nFirst 500 chars:\n${text.slice(0, 500)}`)
    throw new Error(`Failed to parse JSON for ${iso3} ${level}`)
  }
}

async function fetchGeoJson(url: string) {
  const res = await fetch(url)
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Failed to fetch GeoJSON from ${url}: ${res.status}\n${text.slice(0, 500)}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    console.error(`GeoJSON response was not valid JSON. URL: ${url}\nFirst 500 chars:\n${text.slice(0, 500)}`)
    throw new Error(`Failed to parse GeoJSON from ${url}`)
  }
}

function extractRows<T = any>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  const rows = (result as any)?.rows
  if (Array.isArray(rows)) return rows as T[]
  throw new Error(`Unexpected db.execute() result shape: ${JSON.stringify(result)?.slice(0, 200)}`)
}

function getLevelInfo(shapeName: string, level: "ADM0" | "ADM1" | "ADM2") {
  if (level === "ADM0") {
    return { adminLevel: 0, levelType: "country" }
  }

  if (level === "ADM1") {
    const isCharteredCity = ["addis ababa", "dire dawa"].some((city) =>
      shapeName.toLowerCase().includes(city)
    )
    return {
      adminLevel: 1,
      levelType: isCharteredCity ? "chartered_city" : "region",
    }
  }

  return { adminLevel: 2, levelType: "district" }
}

async function main() {
  console.log(`Importing boundaries into 'places' for ${ISO3}...`)

  // 1. ADM0 — Country Level
  const countryMeta = await fetchBoundaryMeta(ISO3, "ADM0")
  const countryGeo: any = await fetchGeoJson(countryMeta.simplifiedGeometryGeoJSON)
  const countryFeature = countryGeo.features[0]
  const countryGeoStr = JSON.stringify(countryFeature.geometry)

  const [countryPlace] = await db
    .insert(places)
    .values({
      name: countryFeature.properties.shapeName ?? "Ethiopia",
      adminLevel: 0,
      levelType: "country",
      parentId: null,
      countryCode: COUNTRY_CODE,
      shapeId: countryFeature.properties.shapeID,
      boundary: sql`ST_Multi(ST_GeomFromGeoJSON(${countryGeoStr}))` as any,
    })
    .onConflictDoNothing({ target: places.shapeId })
    .returning()

  let countryId = countryPlace?.id
  if (!countryId) {
    const existing = await db.query.places.findFirst({
      where: (places, { eq }) => eq(places.shapeId, countryFeature.properties.shapeID),
    })
    countryId = existing!.id
  }
  console.log(`✅ Country ready: Ethiopia (Level 0)`)

  // 2. ADM1 — Regions & Chartered Cities
  const regionMeta = await fetchBoundaryMeta(ISO3, "ADM1")
  const regionGeo: any = await fetchGeoJson(regionMeta.simplifiedGeometryGeoJSON)

  for (const feature of regionGeo.features) {
    const geoJsonStr = JSON.stringify(feature.geometry)
    const shapeName = feature.properties.shapeName
    const { adminLevel, levelType } = getLevelInfo(shapeName, "ADM1")

    await db
      .insert(places)
      .values({
        name: shapeName,
        adminLevel,
        levelType,
        parentId: countryId,
        countryCode: COUNTRY_CODE,
        shapeId: feature.properties.shapeID,
        boundary: sql`ST_Multi(ST_GeomFromGeoJSON(${geoJsonStr}))` as any,
      })
      .onConflictDoNothing({ target: places.shapeId })
  }
  console.log(`✅ Inserted/Verified ${regionGeo.features.length} Level-1 places`)

  // 3. ADM2 — Zones, Sub-cities, and Districts
  const districtMeta = await fetchBoundaryMeta(ISO3, "ADM2")
  const districtGeo: any = await fetchGeoJson(districtMeta.simplifiedGeometryGeoJSON)

  let insertedCount = 0
  let skippedCount = 0

  for (const feature of districtGeo.features) {
    const geoJsonStr = JSON.stringify(feature.geometry)
    const shapeName = feature.properties.shapeName

    const result = await db.execute(sql`
      SELECT id, name, level_type FROM places
      WHERE admin_level = 1
      AND ST_Contains(
        boundary,
        ST_PointOnSurface(ST_GeomFromGeoJSON(${geoJsonStr}))
      )
      LIMIT 1
    `)
    const rows = extractRows<{ id: string; name: string; level_type: string }>(result)
    const matchedParent = rows[0]

    if (!matchedParent) {
      console.warn(`⚠️ No Level-1 parent found for: ${shapeName} — skipping`)
      skippedCount++
      continue
    }

    const levelType = matchedParent.level_type === "chartered_city" ? "sub_city" : "district"

    await db
      .insert(places)
      .values({
        name: shapeName,
        adminLevel: 2,
        levelType,
        parentId: matchedParent.id,
        countryCode: COUNTRY_CODE,
        shapeId: feature.properties.shapeID,
        boundary: sql`ST_Multi(ST_GeomFromGeoJSON(${geoJsonStr}))` as any,
      })
      .onConflictDoNothing({ target: places.shapeId })

    insertedCount++
  }

  console.log(`✅ Processed ${insertedCount} Level-2 places, skipped ${skippedCount}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err)
    process.exit(1)
  })
