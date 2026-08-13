import { useState, useCallback } from "react"
import * as turf from "@turf/turf"
import { fetchCountryPlaces, unlockPlace } from "@/lib/api"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

type CheckInStatus = "idle" | "locating" | "loading" | "success" | "error"

type CheckInResult = {
  unlocked: boolean
  alreadyUnlocked?: boolean
  place?: { id: string; name: string }
  reason?: string
}

export function useCheckIn(onSuccess?: () => void) {
  const [status, setStatus] = useState<CheckInStatus>("idle")
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null)

  const checkIn = useCallback(() => {
    setStatus("locating")
    setError(null)
    setResult(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        setCurrentLocation({ latitude, longitude })
        setStatus("loading")

        try {
          // Reverse-geocode to find the ISO2 country code. Necessary because
          // we don't pre-seed any country boundaries — this is the only way
          // to know which country a raw GPS point falls in on a first visit.
          const geoRes = await fetch(
            `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${longitude}&latitude=${latitude}&access_token=${MAPBOX_TOKEN}`
          )
          const geoData = await geoRes.json()
          // ASSUMPTION: confirm this path matches your Mapbox response shape —
          // adjust if your existing handleMapClick reads it differently.
          const iso2: string | undefined =
            geoData.features?.[0]?.properties?.context?.country?.country_code?.toUpperCase()

          if (!iso2) throw new Error("Could not determine your country from this location.")

          const countryData = await fetchCountryPlaces(iso2)

          if (countryData.status !== "cached") {
            setStatus("error")
            setResult({ unlocked: false, reason: "Still loading this area — try checking in again shortly." })
            return
          }

          // Find which leaf place (no children) actually contains this point,
          // via turf point-in-polygon — only leaf places unlock directly.
          const places = countryData.places
          const childCounts = new Map<string, number>()
          for (const p of places) {
            if (p.parentId) childCounts.set(p.parentId, (childCounts.get(p.parentId) ?? 0) + 1)
          }
          const leaves = places.filter((p) => !childCounts.has(p.id))
          const point = turf.point([longitude, latitude])

          const match = leaves.find((p) => {
            try {
              return turf.booleanPointInPolygon(point, JSON.parse(p.boundary))
            } catch {
              return false
            }
          })

          if (!match) {
            setStatus("error")
            setResult({ unlocked: false, reason: "You don't appear to be inside a mapped area yet." })
            return
          }

          const unlock = await unlockPlace(match.id, latitude, longitude)

          setStatus("success")
          setResult({
            unlocked: true,
            alreadyUnlocked: unlock.alreadyUnlocked ?? false,
            place: { id: match.id, name: match.name },
          })
          onSuccess?.()
        } catch (err) {
          setStatus("error")
          setError(err instanceof Error ? err.message : "Something went wrong")
        }
      },
      () => {
        setStatus("error")
        setError("Couldn't get your location. Check location permissions.")
      },
      { enableHighAccuracy: true }
    )
  }, [onSuccess])

  return { checkIn, status, result, error, currentLocation }
}
