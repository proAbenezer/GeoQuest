import { useEffect, useState, useCallback } from "react"
import * as turf from "@turf/turf"
import { getCachedCountryList, getCachedPlaces } from "@/lib/idb"
import { useUnlockedPlaces } from "./useUnlockedPlaces"
import type { Place } from "@/types/places"

// Loads every place ever cached locally (across all visited countries) and
// exposes a way to check "what place is at this point, and is it unlocked."
// Used by AddPinPanel to gate pin creation to unlocked places only — mirrors
// the same check the backend enforces, so the UI can give immediate feedback
// instead of waiting for a 403.
export function usePlaceLookup() {
  const [leafPlaces, setLeafPlaces] = useState<Place[]>([])
  const { unlocked } = useUnlockedPlaces()
  const unlockedIds = new Set(unlocked.map((u) => u.placeId))

  useEffect(() => {
    ;(async () => {
      const iso2List = await getCachedCountryList()
      if (!iso2List?.length) return
      const all: Place[] = []
      for (const code of iso2List) {
        const cached = await getCachedPlaces(code)
        if (cached) all.push(...cached)
      }
      // Same leaf-detection logic as placesToGeoJson: a place is a leaf
      // if nothing else in the set points at it as a parent.
      const parentIds = new Set(all.filter((p) => p.parentId).map((p) => p.parentId!))
      setLeafPlaces(all.filter((p) => !parentIds.has(p.id)))
    })()
  }, [])

  const findPlaceAt = useCallback(
    (latitude: number, longitude: number) => {
      const point = turf.point([longitude, latitude])
      const match = leafPlaces.find((p) => {
        try {
          return turf.booleanPointInPolygon(point, JSON.parse(p.boundary))
        } catch {
          return false
        }
      })
      if (!match) return { placeId: null, placeName: null, isUnlocked: false }
      return {
        placeId: match.id,
        placeName: match.name,
        isUnlocked: unlockedIds.has(match.id),
      }
    },
    [leafPlaces, unlockedIds]
  )

  return { findPlaceAt }
}
