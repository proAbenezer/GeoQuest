import { useState, useEffect, useRef, useCallback } from "react"
import type { UnlockResult } from "@/types"

interface UseUnlockDistrictOptions {
  onSuccess?: () => void
}

export function useUnlockDistrict(options: UseUnlockDistrictOptions = {}) {
  const { onSuccess } = options
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [result, setResult] = useState<UnlockResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)

  const lastUnlockedCoordsRef = useRef<{ lat: number; lng: number } | null>(null)

  const unlock = useCallback(
    async (latitude: number, longitude: number) => {
      // Don't repeat POST if location hasn't changed beyond ~10 meters
      if (lastUnlockedCoordsRef.current) {
        const diffLat = Math.abs(lastUnlockedCoordsRef.current.lat - latitude)
        const diffLng = Math.abs(lastUnlockedCoordsRef.current.lng - longitude)
        if (diffLat < 0.0001 && diffLng < 0.0001) return
      }

      setStatus("loading")
      setError(null)

      try {
        const res = await fetch("http://localhost:4000/districts/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ latitude, longitude }),
        })

        // 🛡️ Fix 1: Stop SyntaxError crash if backend returns HTML (404/500/Unauthorized)
        if (!res.ok) {
          const rawText = await res.text()
          console.error(`Backend returned HTTP status ${res.status}:`, rawText)
          throw new Error(`Server returned status ${res.status}`)
        }

        const data: UnlockResult = await res.json()
        lastUnlockedCoordsRef.current = { lat: latitude, lng: longitude }

        setResult(data)
        setStatus("idle")

        // 🔄 Fix 2: Automatically refetch map data when unlocked
        if (onSuccess) onSuccess()
      } catch (err: any) {
        console.error("Unlock request failed:", err)
        setError("Couldn't reach server or endpoint returned error.")
        setStatus("error")
      }
    },
    [onSuccess]
  )

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser")
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        console.log("📍 Live Position update:", latitude, longitude)

        setCurrentLocation({ latitude, longitude })
        unlock(latitude, longitude)
      },
      (geoError) => {
        console.warn("Geolocation watch error:", geoError.message)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [unlock])

  return { status, result, error, currentLocation, unlock }
}
