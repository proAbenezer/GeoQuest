import { useState, useCallback, useEffect } from "react"

interface Location {
  latitude: number
  longitude: number
  accuracy?: number
}

type TrackingStatus = "idle" | "locating" | "error"

export function useLocationTracking() {
  const [location, setLocation] = useState<Location | null>(null)
  const [iso2, setIso2] = useState<string | null>(null)
  const [status, setStatus] = useState<TrackingStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  const handleLocationUpdate = useCallback((loc: Location) => {
    setLocation(loc)
    setError(null)
  }, [])

  const handleStatusChange = useCallback((s: TrackingStatus) => {
    setStatus(s)
  }, [])

  const handleError = useCallback((e: GeolocationPositionError | Error) => {
    setStatus("error")
    setError(e.message || "Unable to determine location")
  }, [])

  // Reverse-geocode to country code whenever location changes
  useEffect(() => {
    if (!location) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${location.longitude}&latitude=${location.latitude}&types=country&access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`
        )
        const data = await res.json()
        const code = data.features?.[0]?.properties?.context?.country?.country_code
        if (!cancelled && code) setIso2(code.toUpperCase())
      } catch (err) {
        console.error("Country reverse-geocode failed:", err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location])

  return {
    location,
    iso2,
    status,
    error,
    handleLocationUpdate,
    handleStatusChange,
    handleError,
  }
}
