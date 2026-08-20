// hooks/useAutoUnlock.ts
import { useEffect, useRef, useState } from "react"
import * as turf from "@turf/turf"
import { unlockPlace } from "@/lib/api"
import type { Place, UnlockedEntry } from "@/types/places"

const RECHECK_DISTANCE_M = 15

type UnlockStatus = "idle" | "checking" | "success" | "error"
type UnlockResult = {
  unlocked: boolean
  alreadyUnlocked?: boolean
  place?: { id: string; name: string; address?: string; latitude?: number; longitude?: number }
  reason?: string
}

export function useAutoUnlock(
  location: { latitude: number; longitude: number } | null,
  places: Place[] | null,
  countryStatus: string | undefined,
  unlockedIds: Set<string>,
  onUnlocked?: () => void,
  trackVisitedPlace?: (input: {
    placeId: string
    name: string
    address?: string
    latitude?: number
    longitude?: number
  }) => Promise<boolean>  // ✅ Accept trackVisitedPlace as parameter
) {
  const [status, setStatus] = useState<UnlockStatus>("idle")
  const [result, setResult] = useState<UnlockResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastChecked = useRef<[number, number] | null>(null)

  useEffect(() => {
    if (!location || !places || countryStatus !== "cached") return

    const point: [number, number] = [location.longitude, location.latitude]
    if (lastChecked.current) {
      const movedM =
        turf.distance(turf.point(lastChecked.current), turf.point(point), { units: "kilometers" }) * 1000
      if (movedM < RECHECK_DISTANCE_M) return
    }
    lastChecked.current = point

    const childCounts = new Map<string, number>()
    for (const p of places) {
      if (p.parentId) childCounts.set(p.parentId, (childCounts.get(p.parentId) ?? 0) + 1)
    }
    const leaves = places.filter((p) => !childCounts.has(p.id))
    const turfPoint = turf.point(point)
    const match = leaves.find((p) => {
      try {
        return turf.booleanPointInPolygon(turfPoint, JSON.parse(p.boundary))
      } catch {
        return false
      }
    })

    if (!match) {
      setStatus("idle")
      setResult(null)
      return
    }

    if (unlockedIds.has(match.id)) {
      setStatus("success")
      setResult({ unlocked: true, alreadyUnlocked: true, place: { id: match.id, name: match.name } })
      return
    }

    setStatus("checking")
    unlockPlace(match.id, location.latitude, location.longitude)
      .then((unlock) => {
        setStatus("success")
        const placeData = {
          id: match.id,
          name: match.name,
          address: match.address || match.name,
          latitude: location.latitude,
          longitude: location.longitude,
        }
        setResult({
          unlocked: true,
          alreadyUnlocked: unlock.alreadyUnlocked ?? false,
          place: placeData,
        })
        
        // ✅ Track the visited place when unlocked (if trackVisitedPlace is provided)
        if (trackVisitedPlace) {
          trackVisitedPlace({
            placeId: match.id,
            name: match.name,
            address: match.address || match.name,
            latitude: location.latitude,
            longitude: location.longitude,
          })
        }
        
        onUnlocked?.()
      })
      .catch((err) => {
        setStatus("error")
        setError(err instanceof Error ? err.message : "Unlock failed")
      })
  }, [location, places, countryStatus, unlockedIds, onUnlocked, trackVisitedPlace])

  return { status, result, error }
}
