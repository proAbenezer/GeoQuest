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
// a leaf is 0 or 100, an internal place is exploredChildren / totalChildren.
export type ExplorationEntry = {
  placeId: string
  explored: boolean
  percent: number
}

export type CountryFetchStatus = "not_cached" | "fetching" | "cached" | "failed"
