import { get, set } from "idb-keyval"
import type { Place, UnlockedEntry } from "@/types/places"

const placesKey = (iso2: string) => `geoquest:places:${iso2}`
const UNLOCKED_KEY = "geoquest:unlocked"
const PINS_KEY = "geoquest:pins"

export const getCachedPlaces = (iso2: string) => get(placesKey(iso2)) as Promise<Place[] | undefined>
export const setCachedPlaces = (iso2: string, places: Place[]) => set(placesKey(iso2), places)

export const getCachedUnlocked = () => get(UNLOCKED_KEY) as Promise<UnlockedEntry[] | undefined>
export const setCachedUnlocked = (unlocked: UnlockedEntry[]) => set(UNLOCKED_KEY, unlocked)

export const getCachedPins = () => get(PINS_KEY) as Promise<unknown[] | undefined>
export const setCachedPins = (pins: unknown[]) => set(PINS_KEY, pins)
