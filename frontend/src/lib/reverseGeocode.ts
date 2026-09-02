// lib/reverseGeocode.ts
//
// Precise reverse-geocoding for map clicks. A bare Mapbox Search v6 reverse
// call (`search/geocode/v6/reverse` with no params) biases toward the coarsest
// stable hit — the city — so a click in Yeka came back titled "Addis Ababa"
// with exact coordinates. For adding a pin you want the thing under the cursor:
// the street, the house, the neighbourhood — not the city.
//
// Approach: one v6 reverse call requesting the fine administrative types
// (address, street, locality, neighborhood, place). Each result is ranked
// fine→coarse, and we take the most specific one that actually sits near the
// click (an address must be on the point, a street close, while the
// neighbourhood/city name is always accepted as a graceful fallback). If the
// fine query returns nothing usable, a second plain call falls back to the
// coarsest area name so a click never dead-ends. v6 reverse never returns POIs
// and v5 reverse excludes them too, so shop/park *names* aren't resolvable via
// Mapbox reverse — best we can do is the street the place is on.
//
// Robustness details:
//  - Street features may come back as a LineString (or carry their point under
//    `properties.coordinates`), so distance is computed against every returned
//    coordinate vertex, never a single mis-shaped field.
//  - If the fine query returns nothing usable, a plain un-typed reverse call
//    keeps the old behaviour (click still resolves to a coarse area name).

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export interface ReverseGeocodeResult {
  placeId: string
  placeName: string
  address: string
}

// Fine → coarse; lower wins. Feature types not in this map are ignored.
const RANK: Record<string, number> = {
  address: 1,
  street: 2,
  neighborhood: 3,
  locality: 4,
  place: 5,
}

// Fine-grained candidates only count when they're basically under the click
// (streets a little more loosely). Anything coarse is always acceptable.
const MAX_DIST_M: Record<string, number> = {
  address: 250,
  street: 1500,
}

// v6 administrative types only. `poi` is deliberately absent (not supported by
// v6 reverse), as are country/region/postcode (too coarse to be useful).
const V6_TYPES = "address,street,locality,neighborhood,place"

interface Candidate {
  type: string
  rank: number
  name: string
  address: string
  distM: number
  id: string
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Every coordinate vertex described by a feature, in [lng, lat] form. Handles
// the Point geometry v6 gives most types, the LineString it can give streets,
// and the representative `properties.coordinates` point.
function coordinateVertices(feature: {
  geometry?: { coordinates?: unknown }
  properties?: { coordinates?: unknown }
}): number[][] {
  const points: number[][] = []

  const pc = feature.properties?.coordinates
  if (Array.isArray(pc) && typeof pc[0] === "number") {
    points.push(pc as number[])
  }

  const gc = feature.geometry?.coordinates
  if (Array.isArray(gc)) {
    const collect = (node: unknown) => {
      if (
        Array.isArray(node) &&
        node.length >= 2 &&
        typeof node[0] === "number" &&
        typeof node[1] === "number"
      ) {
        points.push(node as number[])
      } else if (Array.isArray(node)) {
        node.forEach(collect)
      }
    }
    collect(gc)
  }
  return points
}

function nearestDistanceM(
  lat: number,
  lng: number,
  vertices: number[][]
): number {
  let best = Infinity
  for (const [plng, plat] of vertices) {
    if (typeof plng !== "number" || typeof plat !== "number") continue
    const d = haversineMeters(lat, lng, plat, plng)
    if (d < best) best = d
  }
  return best
}

function pickBest(candidates: Candidate[]): Candidate | null {
  const viable = candidates.filter(
    (c) => MAX_DIST_M[c.type] === undefined || c.distM <= MAX_DIST_M[c.type]
  )
  if (viable.length === 0) return null
  viable.sort((a, b) => a.rank - b.rank || a.distM - b.distM)
  return viable[0]
}

// The v6 `place_formatted`/`full_address` string starts with the feature's own
// name ("Bole Road, Addis Ababa, …"). Strip that duplicate prefix when the
// chosen name is shown separately on its own line.
function trimNamePrefix(full: string, name: string): string {
  const prefix = `${name}, `
  if (full && full.startsWith(prefix)) return full.slice(prefix.length)
  if (full === name) return ""
  return full
}

export async function reverseGeocodeClick(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult | null> {
  const parseFeatures = (body: unknown) => {
    const features = (body as { features?: unknown[] })?.features ?? []
    const out: Candidate[] = []
    for (const f of features as Array<{
      id?: string
      geometry?: { coordinates?: unknown }
      properties?: {
        feature_type?: string
        name?: string
        mapbox_id?: string
        full_address?: string
        place_formatted?: string
        coordinates?: unknown
      }
    }>) {
      const type = f.properties?.feature_type ?? ""
      const rank = RANK[type]
      if (rank === undefined) continue
      const name = f.properties?.name ?? "Unknown Place"
      const full =
        f.properties?.full_address ??
        f.properties?.place_formatted ??
        name
      out.push({
        type,
        rank,
        name,
        address: trimNamePrefix(full, name),
        distM: nearestDistanceM(
          latitude,
          longitude,
          coordinateVertices(f)
        ),
        id:
          f.properties?.mapbox_id ??
          f.id ??
          `place_${Date.now()}_${out.length}`,
      })
    }
    return out
  }

  // No `limit` on these calls: Mapbox's v6 reverse endpoint rejects the
  // parameter with a 422 (the one reverse call in this app that works —
  // types=country in MapView — carries none), so the server default applies.
  const run = async (extraQuery: string): Promise<Candidate[]> => {
    const res = await fetch(
      `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${longitude}&latitude=${latitude}` +
        `${extraQuery}&access_token=${TOKEN}`
    ).catch(() => null)
    if (!res || !res.ok) return []
    try {
      return parseFeatures(await res.json())
    } catch (err) {
      console.error("Reverse-geocode parse failed:", err)
      return []
    }
  }

  // 1) The precise query: only fine administrative types, ranked fine→coarse
  //    and then by distance from the click.
  let candidates: Candidate[] = await run(`&types=${V6_TYPES}`)
  let chosen = pickBest(candidates)

  // 2) Safety net: the fine query can come back empty (e.g. clicked outside any
  //    mapped street/address) or, even when it returns features, all of them
  //    can sit beyond the fine-type distance caps — leaving pickBest with
  //    nothing. A plain un-typed reverse call restores the previous behaviour,
  //    so a click always resolves to at least a coarse area name instead of
  //    doing nothing.
  if (!chosen) {
    const coarse = await run("")
    if (coarse.length > 0) {
      candidates = coarse
      chosen = pickBest(candidates)
    }
  }

  if (!chosen) return null

  return {
    placeId: chosen.id,
    placeName: chosen.name,
    address: chosen.address || chosen.name,
  }
}
