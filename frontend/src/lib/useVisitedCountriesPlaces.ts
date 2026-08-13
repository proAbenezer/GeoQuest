import { useState, useEffect, useRef } from "react"
import { useCountryPlaces } from "./useCountryPlaces"
import { getCachedCountryList, getCachedPlaces } from "@/lib/idb"
import type { Place, UnlockedEntry } from "@/types/places"

export function useVisitedCountriesPlaces(iso2: string | null, unlocked: UnlockedEntry[]) {
  const { places: currentPlaces, status: countryStatus } = useCountryPlaces(iso2)
  const placesByCountry = useRef<Map<string, Place[]>>(new Map())
  const [allPlaces, setAllPlaces] = useState<Place[]>([])
  const seededRef = useRef(false)

  // On mount: re-seed every previously-cached country from IndexedDB, so a
  // page reload doesn't lose everything except whatever country you're
  // currently standing in. Runs once.
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    ;(async () => {
      const cachedIso2List = await getCachedCountryList()
      if (!cachedIso2List?.length) return
      for (const code of cachedIso2List) {
        const cached = await getCachedPlaces(code)
        if (cached) placesByCountry.current.set(code, cached)
      }
      setAllPlaces(Array.from(placesByCountry.current.values()).flat())
    })()
  }, [])

  // Accumulate the currently-active country's places as they load.
  useEffect(() => {
    if (!iso2 || !currentPlaces || countryStatus !== "cached") return
    placesByCountry.current.set(iso2, currentPlaces)
    setAllPlaces(Array.from(placesByCountry.current.values()).flat())
  }, [iso2, currentPlaces, countryStatus])

  // "Visited" for the world overlay means REAL unlock progress, not just
  // "we fetched this country's boundary data." A country's fog only clears
  // once at least one place inside it has an actual unlock record.
  const unlockedPlaceIds = new Set(unlocked.map((u) => u.placeId))
  const visitedIso2 = new Set<string>()
  for (const places of placesByCountry.current.values()) {
    for (const p of places) {
      if (unlockedPlaceIds.has(p.id)) {
        visitedIso2.add(p.countryCode)
        break
      }
    }
  }

  return { places: allPlaces, visitedIso2, currentCountryStatus: countryStatus }
}
