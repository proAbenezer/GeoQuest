// lib/poiFromClick.ts
//
// Precision beyond reverse geocoding for map clicks. Mapbox's reverse geocoder
// only returns administrative types — never a POI (shop/hospital/park) — so a
// click on a hospital resolves to the street at best. Two tile/OSM sources
// recover the actual place name from a coordinate:
//
//   1. mapbox POI labels: the basemap already draws named points of interest,
//      so when one is under (or very near) the cursor we read its name straight
//      out of the rendered vector tiles — synchronous, no extra network call.
//   2. OpenStreetMap fallback: when the basemap labels nothing there (common
//      for smaller local places), Overpass finds the nearest *named* POI (an
//      element whose tags say it's a place rather than a road) so the click can
//      still be titled precisely instead of dropping to the street name.
//
// The Mapbox side covers what Mapbox labels at the current zoom (hospitals,
// landmarks, bigger shops and parks). OSM is the safety net and often the only
// source for local Addis points.

export interface ClickedPoi {
  name: string
  longitude: number
  latitude: number
  /** Stable-ish dedupe key, e.g. "osm:node/123" or a mapbox anchor hash. */
  id: string
}

// Tag keys that identify a place worth naming (vs a road or an admin boundary).
// Kept as a value-tested regex because Overpass's tag regex engine has no
// lookahead — express "these keys, any value" instead of exclusions.
const OSM_POI_KEYS =
  "amenity|shop|tourism|leisure|healthcare|office|craft|historic|man_made|" +
  "building|aeroway|railway|public_transport|emergency"

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
]

// POI label layer ids change between Mapbox style revisions, so don't hardcode
// them: collect whatever the loaded style draws from the basemap's poi_label
// source-layer (or legacy poi-* ids). Empty when the style exposes none, in
// which case the label lookup is skipped and only OSM runs.
function poiLayerIds(map: any): string[] {
  const layers = map?.getStyle?.()?.layers
  if (!Array.isArray(layers)) return []
  const ids: string[] = []
  for (const layer of layers) {
    if (!layer) continue
    if (layer["source-layer"] === "poi_label" || /^poi[-_]/.test(layer.id)) {
      ids.push(layer.id)
    }
  }
  return ids
}

// Prefer the Latin spelling when the tile carries one; otherwise fall back to
// the primary (possibly Amharic) name Mapbox drew on the map.
function labelName(properties: any): string {
  const value =
    properties?.name_en ?? properties?.name ?? properties?.name_local ?? properties?.text
  return typeof value === "string" ? value.trim() : ""
}

const poiSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "poi"

/**
 * The name of the mapbox-drawn POI under the cursor, if any. `point` is the
 * click in screen pixels — it picks the query bbox and is used to reject labels
 * whose *anchor* sits far from the cursor (a wide label can overlap the bbox
 * without being the thing you clicked).
 */
export function poiLabelAt(
  map: any,
  point: { x: number; y: number }
): ClickedPoi | null {
  const ids = poiLayerIds(map)
  if (!ids.length) return null

  const radius = 18
  let features: any[] = []
  try {
    features = map.queryRenderedFeatures(
      [
        [point.x - radius, point.y - radius],
        [point.x + radius, point.y + radius],
      ],
      { layers: ids }
    )
  } catch (err) {
    console.error("POI label query failed:", err)
    return null
  }

  let best: ClickedPoi | null = null
  let bestDist = Infinity
  for (const feature of features) {
    const name = labelName(feature?.properties)
    if (!name) continue
    const coords = feature?.geometry?.coordinates
    if (!Array.isArray(coords) || typeof coords[0] !== "number") continue
    const [lng, lat] = coords as [number, number]
    let screen: { x: number; y: number }
    try {
      screen = map.project([lng, lat])
    } catch {
      continue
    }
    const dist = Math.hypot(screen.x - point.x, screen.y - point.y)
    if (dist < bestDist) {
      bestDist = dist
      best = {
        name,
        longitude: lng,
        latitude: lat,
        id: `mapbox:${poiSlug(name)}:${lng.toFixed(4)},${lat.toFixed(4)}`,
      }
    }
  }
  // Label placement can offset a glyph from its anchor, but not by much —
  // beyond this the hit is probably a neighbour's label, not the target.
  return best && bestDist <= 40 ? best : null
}

// Nearest named OSM element to the coordinate, or null when none (or on any
// failure). Prefers the :en name when present so the title stays readable.
export async function osmNearestNamed(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<ClickedPoi | null> {
  const query =
    `[out:json][timeout:6];(` +
    `nwr(around:220,${latitude},${longitude})[name]` +
    `[~"^(${OSM_POI_KEYS})$"~"."];` +
    `);out center;`

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      })
      if (!res.ok) continue
      const data = await res.json()
      const elements = data?.elements
      if (!Array.isArray(elements) || elements.length === 0) continue
      return nearestNamed(elements, latitude, longitude)
    } catch {
      if (signal?.aborted) return null
      continue // try the mirror endpoint
    }
  }
  return null
}

function nearestNamed(
  elements: any[],
  latitude: number,
  longitude: number
): ClickedPoi | null {
  let best: ClickedPoi | null = null
  let bestDistSq = Infinity
  for (const el of elements) {
    const name = el?.tags?.["name:en"] ?? el?.tags?.name
    if (typeof name !== "string" || !name.trim()) continue
    const plat = el?.center?.lat ?? el?.lat
    const plng = el?.center?.lon ?? el?.lon
    if (typeof plat !== "number" || typeof plng !== "number") continue
    // Squared degree distance is fine for ranking within a couple hundred metres.
    const dLat = plat - latitude
    const dLng = plng - longitude
    const distSq = dLat * dLat + dLng * dLng
    if (distSq < bestDistSq) {
      bestDistSq = distSq
      best = {
        name: name.trim(),
        longitude: plng,
        latitude: plat,
        id: `osm:${el.type}/${el.id}`,
      }
    }
  }
  return best
}
