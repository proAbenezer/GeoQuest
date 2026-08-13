import { useEffect, useRef, useState } from "react"
import * as turf from "@turf/turf"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const REGEOCODE_DISTANCE_KM = 20 // re-check country only after moving this far

export type TrackingStatus = "idle" | "locating" | "tracking" | "error"

export function useLocationTracking() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [iso2, setIso2] = useState<string | null>(null)
  const [status, setStatus] = useState<TrackingStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const lastGeocodedPoint = useRef<[number, number] | null>(null)

  useEffect(() => {
    setStatus("locating")
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        setLocation({ latitude, longitude })
        setStatus("tracking")
        setError(null)

        const point: [number, number] = [longitude, latitude]
        const needsGeocode =
          !lastGeocodedPoint.current ||
          turf.distance(turf.point(lastGeocodedPoint.current), turf.point(point), { units: "kilometers" }) >
            REGEOCODE_DISTANCE_KM

        if (needsGeocode) {
          lastGeocodedPoint.current = point
          try {
            const res = await fetch(
              `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${longitude}&latitude=${latitude}&access_token=${MAPBOX_TOKEN}`
            )
            const data = await res.json()
            const detected: string | undefined =
              data.features?.[0]?.properties?.context?.country?.country_code?.toUpperCase()
            if (detected) setIso2(detected)
          } catch (err) {
            console.error("Reverse geocode failed:", err)
          }
        }
      },
      () => {
        setStatus("error")
        setError("Couldn't get your location. Check location permissions.")
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  return { location, iso2, status, error }
}
