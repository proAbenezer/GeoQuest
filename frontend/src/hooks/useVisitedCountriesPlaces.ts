import { useState, useEffect, useRef } from "react"
import { useCountryPlaces } from "./useCountryPlaces"
import { getCachedCountryList, getCachedPlaces, setCachedPlaces } from "@/lib/idb"
import { fetchUnlockedCountries, fetchCountryPlaces } from "@/lib/api"
import type { Place, UnlockedEntry } from "@/types/places"

export function useVisitedCountriesPlaces(iso2: string | null, unlocked: UnlockedEntry[]) {
  const { places: currentPlaces, status: countryStatus } = useCountryPlaces(iso2)
  const placesByCountry = useRef<Map<string, Place[]>>(new Map())
  const [allPlaces, setAllPlaces] = useState<Place[]>([])
  const seededRef = useRef(false)

  // On mount: load every country with real unlock progress, from TWO sources —
  // (1) whatever's already cached locally in IndexedDB (fast, no network), and
  // (2) the server's authoritative "which countries do I have unlocks in" list,
  // fetching any that aren't already cached locally. This runs regardless of
  // whether live geolocation ever resolves — GPS status should never gate
  // whether previously-unlocked places render.
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    ;(async () => {
      const localIso2List = await getCachedCountryList()
      if (localIso2List?.length) {
        for (const code of localIso2List) {
          const cached = await getCachedPlaces(code)
          if (cached) placesByCountry.current.set(code, cached)
        }
        setAllPlaces(Array.from(placesByCountry.current.values()).flat())
      }

      try {
        const { countryCodes } = await fetchUnlockedCountries()
        const missing = countryCodes.filter((code) => !placesByCountry.current.has(code))
        for (const code of missing) {
          const data = await fetchCountryPlaces(code)
          if (data.status === "cached") {
            placesByCountry.current.set(code, data.places)
            await setCachedPlaces(code, data.places)
          }
        }
        if (missing.length) {
          setAllPlaces(Array.from(placesByCountry.current.values()).flat())
        }
      } catch (err) {
        console.error("Failed to load unlocked countries:", err)
      }
    })()
  }, [])

  // Accumulate the currently-active (geolocation-detected) country's places
  // as they load. This still matters for auto-unlocking NEW places when
  // GPS does resolve — separate concern from the above mount-time seeding.
  useEffect(() => {
    if (!iso2 || !currentPlaces || countryStatus !== "cached") return
    placesByCountry.current.set(iso2, currentPlaces)
    setAllPlaces(Array.from(placesByCountry.current.values()).flat())
  }, [iso2, currentPlaces, countryStatus])

  // "Visited" for the world overlay means REAL unlock progress, not just
  // "we fetched this country's boundary data."
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
