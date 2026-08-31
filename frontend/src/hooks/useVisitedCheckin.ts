// hooks/useVisitedCheckin.ts
import { useEffect, useRef } from "react"
import { usePins } from "@/context/usePins"

// Radius (metres) within which the user counts as having physically visited a
// pinned location. 50–100m was the requested range; 75m sits in the middle —
// roughly the accuracy floor of a GPS fix plus a little walking slack.
export const VISITED_RADIUS_M = 75

// Haversine great-circle distance between two coordinates, in metres.
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * GPS proximity check-in. Every time the user's location updates (reusing the
 * existing single location watcher from `useLocationTracking` — no second
 * watcher), every pin the current identity created that is still marked
 * unvisited and sits within `VISITED_RADIUS_M` of the fix is flipped to
 * `visited` and persisted through the normal `updatePin` path, so the state
 * survives reloads. Pins in context are already owner-scoped (the pins API
 * returns only the current identity's pins), so this never touches another
 * user's pin.
 */
export function useVisitedCheckin(location: { latitude: number; longitude: number } | null) {
  const { pins, updatePin } = usePins()

  // Pins we've already asked the server to mark visited this session, so rapid
  // GPS updates don't re-PATCH the same pin repeatedly. The `pin.visited` flag
  // in context handles the steady state; this set covers the async window.
  const requestedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!location) return
    const { latitude, longitude } = location
    const toMark = pins.filter(
      (pin) =>
        !pin.visited &&
        !requestedRef.current.has(pin.id) &&
        distanceM(latitude, longitude, pin.latitude, pin.longitude) <= VISITED_RADIUS_M
    )
    for (const pin of toMark) {
      requestedRef.current.add(pin.id)
      updatePin(pin.id, { visited: true }).catch(() => {
        // Persistence failed — forget it so the next location update retries.
        requestedRef.current.delete(pin.id)
      })
    }
  }, [location, pins, updatePin])
}
