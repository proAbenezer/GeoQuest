export type Place = {
  id: string
  name: string
  adminLevel: number
  levelType: string
  parentId: string | null
  countryCode: string
  boundary: string // raw GeoJSON geometry string — JSON.parse before use
}

export type UnlockedEntry = {
  placeId: string
  unlockedAt: string
}

// Per-node exploration roll-up, persisted server-side per identity (see
// GET /places/exploration). `percent` is the bottom-up aggregate for a node —
// a leaf is 0 or 100; an internal place is the AREA-WEIGHTED AVERAGE of its
// children's percents (a partially-explored child rolls its share up to the
// parent). Double precision, so a tiny-but-real share isn't truncated to 0.
export type ExplorationEntry = {
  placeId: string
  explored: boolean
  percent: number
}

export type CountryFetchStatus = "not_cached" | "fetching" | "cached" | "failed"

// --- Stats dashboard (item 14) ---
export type CountryStat = {
  iso2: string
  name: string
  continent: string | null
  places: number
  days: number
  firstVisitAt: string | null
  lastVisitAt: string | null
  explorationPercent: number | null
}

export type TravelStats = {
  summary: {
    countriesVisited: number
    totalPlaces: number
    totalDays: number
    firstVisitAt: string | null
    lastVisitAt: string | null
  }
  countries: CountryStat[]
  streak: {
    longestDays: number
    iso2: string
    name: string
    continent: string | null
  } | null
  categories: { name: string; count: number }[]
}

// A route (start pin → end pin) that has comments, with its comment count and
// both endpoint pins' names + coordinates. Drives the map overlay that makes
// route conversations discoverable.
export type CommentRoute = {
  routeStartPinId: string
  routeEndPinId: string
  count: number
  startName: string
  endName: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
}
