import { useState, useCallback, useEffect } from "react"

export function useDistrictsGeoJson() {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null)

  const refetch = useCallback(async () => {
    const res = await fetch("http://localhost:4000/districts", {
      credentials: "include",
    })
    setData(await res.json())
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, refetch }
}
