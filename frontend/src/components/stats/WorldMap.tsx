// components/stats/WorldMap.tsx
// Shaded world map for the stats dashboard. Fills every country the user has
// check-ins in (their cached boundary polygons) with the brand color on the
// dark basemap; unvisited countries stay as raw Mapbox terrain.
//
// Presentational: the country-tree places are seeded ONCE by the page
// (StatsPage) and passed in, so the world shading and the region-exploration
// card share a single download instead of each fetching the full tree.
import { useMemo } from "react"
import Map from "react-map-gl/mapbox"
import { Source, Layer } from "react-map-gl/mapbox"
import type { Place } from "@/types/place"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const BRAND_COLOR = "#00B47B"

export default function WorldMap({ places }: { places: Place[] }) {
  const geojson = useMemo(() => {
    if (!places.length) return null
    const features = []
    for (const p of places) {
      if (p.parentId) continue // country root only — that's the country outline
      let geometry: GeoJSON.Geometry | null = null
      try {
        geometry = JSON.parse(p.boundary) as GeoJSON.Geometry
      } catch {
        geometry = null
      }
      if (!geometry) continue
      features.push({
        type: "Feature" as const,
        geometry,
        properties: { name: p.name, iso2: p.countryCode },
      })
    }
    return features.length
      ? ({ type: "FeatureCollection" as const, features } as GeoJSON.FeatureCollection)
      : null
  }, [places])

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{ longitude: 0, latitude: 25, zoom: 1.1 }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      style={{ width: "100%", height: "100%" }}
      attributionControl={false}
      interactive={false}
    >
      {geojson && (
        <Source id="visited-countries" type="geojson" data={geojson}>
          <Layer
            id="visited-fill"
            type="fill"
            paint={{ "fill-color": BRAND_COLOR, "fill-opacity": 0.4 }}
          />
          <Layer
            id="visited-outline"
            type="line"
            paint={{ "line-color": BRAND_COLOR, "line-width": 1.5, "line-opacity": 0.85 }}
          />
        </Source>
      )}
    </Map>
  )
}
