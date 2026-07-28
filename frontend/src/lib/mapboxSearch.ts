import type { Suggestion, SelectedLocation } from "@/types/location"

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export async function fetchSuggestions(query: string, sessionToken: string) {
  const res = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(
      query
    )}&session_token=${sessionToken}&access_token=${TOKEN}`
  )
  const data = await res.json()
  return (data.suggestions ?? []) as Suggestion[]
}

export async function retrieveLocation(
  mapboxId: string,
  sessionToken: string
): Promise<SelectedLocation | null> {
  const res = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}?session_token=${sessionToken}&access_token=${TOKEN}`
  )
  const data = await res.json()
  const feature = data.features?.[0]
  if (!feature) return null
  return {
    placeName: feature.properties.name,
    address:
      feature.properties.full_address ?? feature.properties.place_formatted,
    latitude: feature.geometry.coordinates[1],
    longitude: feature.geometry.coordinates[0],
  }
}
