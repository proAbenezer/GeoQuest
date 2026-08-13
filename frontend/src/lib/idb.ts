import { get, set } from "idb-keyval"
import type { Place, UnlockedEntry } from "@/types/places"

const placesKey = (iso2: string) => `geoquest:places:${iso2}`
const UNLOCKED_KEY = "geoquest:unlocked"
const PINS_KEY = "geoquest:pins"
const CACHED_COUNTRIES_KEY = "geoquest:cached-countries"

export const getCachedPlaces = (iso2: string) => get(placesKey(iso2)) as Promise<Place[] | undefined>
export const setCachedPlaces = async (iso2: string, places: Place[]) => {
  await set(placesKey(iso2), places)
  const existing = (await get(CACHED_COUNTRIES_KEY)) as string[] | undefined
  const updated = Array.from(new Set([...(existing ?? []), iso2]))
  await set(CACHED_COUNTRIES_KEY, updated)
}

// List every country we've ever cached locally, so a reload can re-seed
// the accumulated multi-country places without re-fetching from the server.
export const getCachedCountryList = () => get(CACHED_COUNTRIES_KEY) as Promise<string[] | undefined>

export const getCachedUnlocked = () => get(UNLOCKED_KEY) as Promise<UnlockedEntry[] | undefined>
export const setCachedUnlocked = (unlocked: UnlockedEntry[]) => set(UNLOCKED_KEY, unlocked)

export const getCachedPins = () => get(PINS_KEY) as Promise<unknown[] | undefined>
export const setCachedPins = (pins: unknown[]) => set(PINS_KEY, pins)
