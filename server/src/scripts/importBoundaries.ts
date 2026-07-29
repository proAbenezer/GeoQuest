import "dotenv/config"
import { sql } from "drizzle-orm"
import { db } from "../db/index.js"
import { countries, regions, districts } from "../db/schema.js"

const ISO3 = "ETH" // Ethiopia's ISO 3166-1 alpha-3 code

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

function geometryToJson(geometry: any): string {
  // PostGIS can parse GeoJSON geometry directly via ST_GeomFromGeoJSON,
  // so we pass the geometry object as a JSON string.
  return JSON.stringify(geometry)
}

// db.execute() return shape differs by driver:
// - postgres-js resolves to the rows array directly
// - node-postgres (pg) resolves to a result object with a `.rows` property
// This helper normalizes both so the rest of the script doesn't care which one we're on.
function extractRows<T = any>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  const rows = (result as any)?.rows
  if (Array.isArray(rows)) return rows as T[]
  throw new Error(`Unexpected db.execute() result shape: ${JSON.stringify(result)?.slice(0, 200)}`)
}

async function main() {
  console.log(`Importing boundaries for ${ISO3}...`)

  // ADM0 — Country
  const countryMeta = await fetchBoundaryMeta(ISO3, "ADM0")
  const countryGeo: any = await fetchGeoJson(countryMeta.simplifiedGeometryGeoJSON)
  const countryFeature = countryGeo.features[0]

  const [country] = await db
    .insert(countries)
    .values({
      name: countryFeature.properties.shapeName ?? "Ethiopia",
      shapeId: countryFeature.properties.shapeID,
      boundary: geometryToJson(countryFeature.geometry) as any,
    })
    .returning()
  console.log(`Inserted country: ${country.name}`)

  // ADM1 — Regions
  const regionMeta = await fetchBoundaryMeta(ISO3, "ADM1")
  const regionGeo: any = await fetchGeoJson(regionMeta.simplifiedGeometryGeoJSON)

  for (const feature of regionGeo.features) {
    await db.insert(regions).values({
      countryId: country.id,
      name: feature.properties.shapeName,
      shapeId: feature.properties.shapeID,
      boundary: geometryToJson(feature.geometry) as any,
    })
  }
  console.log(`Inserted ${regionGeo.features.length} regions`)

  // ADM2 — Districts
  const districtMeta = await fetchBoundaryMeta(ISO3, "ADM2")
  const districtGeo: any = await fetchGeoJson(districtMeta.simplifiedGeometryGeoJSON)

  let insertedCount = 0
  let skippedCount = 0

  for (const feature of districtGeo.features) {
    const geoJsonStr = geometryToJson(feature.geometry)

    // Find which region contains this district's representative point
    const result = await db.execute(sql`
      SELECT id FROM regions
      WHERE ST_Contains(
        boundary,
        ST_PointOnSurface(ST_GeomFromGeoJSON(${geoJsonStr}))
      )
      LIMIT 1
    `)
    const rows = extractRows<{ id: string }>(result)
    const matchedRegion = rows[0]

    if (!matchedRegion) {
      console.warn(`No parent region found for district: ${feature.properties.shapeName} — skipping`)
      skippedCount++
      continue
    }

    await db.insert(districts).values({
      regionId: matchedRegion.id,
      name: feature.properties.shapeName,
      shapeId: feature.properties.shapeID,
      boundary: geoJsonStr as any,
    })
    insertedCount++
  }

  console.log(`Inserted ${insertedCount} districts, skipped ${skippedCount} (no parent region match)`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
