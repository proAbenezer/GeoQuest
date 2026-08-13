import { useState, useEffect, useRef } from "react"
import { useCountryPlaces } from "./useCountryPlaces"

export function useVisitedCountriesPlaces(iso2: string | null) {
  const { places: currentPlaces, status: countryStatus } = useCountryPlaces(iso2)
  const placesByCountry = useRef<Map<string, any[]>>(new Map())
  const [allPlaces, setAllPlaces] = useState<any[]>([])
  const [visitedIso2, setVisitedIso2] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!iso2 || !currentPlaces || countryStatus !== "cached") return
    placesByCountry.current.set(iso2, currentPlaces)
    setAllPlaces(Array.from(placesByCountry.current.values()).flat())
    setVisitedIso2(new Set(placesByCountry.current.keys()))
  }, [iso2, currentPlaces, countryStatus])

  return { places: allPlaces, visitedIso2, currentCountryStatus: countryStatus }
}
