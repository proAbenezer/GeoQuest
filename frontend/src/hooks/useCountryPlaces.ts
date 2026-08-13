import { useState, useEffect, useCallback, useRef } from "react"
import { fetchCountryPlaces } from "@/lib/api"
import { getCachedPlaces, setCachedPlaces } from "@/lib/idb"
import type { Place, CountryFetchStatus } from "@/types/places"

const POLL_INTERVAL_MS = 3000

// iso2 = null means "we don't know the country yet" (before initial geolocation resolves).
// Returns places = null while genuinely uncached — MapView uses this to draw nothing + show a toast.
export function useCountryPlaces(iso2: string | null) {
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [status, setStatus] = useState<CountryFetchStatus | "idle">("idle")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    if (!iso2) return
    try {
      const data = await fetchCountryPlaces(iso2)
      setStatus(data.status)
      if (data.status === "cached") {
        setPlaces(data.places)
        await setCachedPlaces(iso2, data.places)
      }
    } catch {
      setStatus("failed")
    }
  }, [iso2])

  useEffect(() => {
    if (!iso2) return
    let cancelled = false

    async function init() {
      const cached = await getCachedPlaces(iso2!)
      if (cached && !cancelled) {
        setPlaces(cached)
        setStatus("cached")
      }
      // Always re-check the server too — confirms freshness and catches
      // the very first visit to a country that isn't cached anywhere.
      await refresh()
    }
    init()

    return () => { cancelled = true }
  }, [iso2, refresh])

  // Poll while the server is actively fetching this country.
  useEffect(() => {
    if (status !== "fetching") return
    pollRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [status, refresh])

  return { places, status, refresh }
}
