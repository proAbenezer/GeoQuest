// src/services/fetchCountryBoundaries.ts
//
// Core geoBoundaries fetch + import logic. Used by BOTH the CLI script
// (src/scripts/fetchCountry.ts) and the API route (src/routes/places.ts).

import { db } from "../db/index.js"
import { places, countryFetchStatus } from "../db/schema.js"
import { eq, sql } from "drizzle-orm"
import * as turf from "@turf/turf"
import countries from "i18n-iso-countries"
import enLocale from "i18n-iso-countries/langs/en.json" with { type: "json" }

countries.registerLocale(enLocale)

type GBMetaEntry = {
  boundaryISO: string
  boundaryType: string
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

export function iso2ToIso3(iso2: string): string | undefined {
  return countries.alpha2ToAlpha3(iso2.toUpperCase())
}

export async function fetchCountryBoundaries(iso2Raw: string): Promise<void> {
  const iso2 = iso2Raw.toUpperCase()
  const iso3 = iso2ToIso3(iso2)

  if (!iso3) {
    throw new Error(`"${iso2}" is not a recognized ISO2 country code.`)
  }

  await db
    .insert(countryFetchStatus)
    .values({ countryCode: iso2, status: "fetching", requestedAt: new Date() })
    .onConflictDoUpdate({
      target: countryFetchStatus.countryCode,
      set: { status: "fetching", requestedAt: new Date(), errorMessage: null },
    })

  try {
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

    metadata.sort((a, b) => {
      const levelA = parseInt(a.boundaryType.replace("ADM", ""), 10)
      const levelB = parseInt(b.boundaryType.replace("ADM", ""), 10)
      return levelA - levelB
    })

    let previousLevelRows: { id: string; geom: turf.Feature }[] = []

    for (const level of metadata) {
      const adminLevel = parseInt(level.boundaryType.replace("ADM", ""), 10)

      if (!level.simplifiedGeometryGeoJSON) continue

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
            levelType: level.boundaryType,
            parentId,
            countryCode: iso2,
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

      previousLevelRows = currentLevelRows
    }

    await db
      .update(countryFetchStatus)
      .set({ status: "cached", completedAt: new Date() })
      .where(eq(countryFetchStatus.countryCode, iso2))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db
      .update(countryFetchStatus)
      .set({ status: "failed", errorMessage: message })
      .where(eq(countryFetchStatus.countryCode, iso2))
    throw err
  }
}
