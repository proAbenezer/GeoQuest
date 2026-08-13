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

export type CountryFetchStatus = "not_cached" | "fetching" | "cached" | "failed"
