import { useState } from "react"


import type { UnlockResult } from "@/types"





export function useUnlockDistrict() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [result, setResult] = useState<UnlockResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function checkIn() {
    if (!navigator.geolocation) {
      setError("Geolocation isn't supported in this browser")
      setStatus("error")
      return
    }

    setStatus("loading")
    setError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch("http://localhost:4000/districts/unlock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // sends the guest/auth cookie
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          })
          const data: UnlockResult = await res.json()
          setResult(data)
          setStatus("idle")
        } catch {
          setError("Couldn't reach the server")
          setStatus("error")
        }
      },
      (geoError) => {
        setError(geoError.message)
        setStatus("error")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return { checkIn, status, result, error }
}
