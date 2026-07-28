const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export async function searchPlace(query: string) {
  console.log(query)
  const response = await fetch(
    `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&access_token=${TOKEN}`
  )

  const data = await response.json()

  if (!data.features.length) {
    return null
  }

  const place = data.features[0]

  return {
    name: place.properties.name,

    latitude: place.geometry.coordinates[1],

    longitude: place.geometry.coordinates[0],

    address: place.properties.full_address,
  }
}
