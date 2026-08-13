// WorldOverlayLayer.tsx
import { useEffect, useRef } from "react"
import { useMap } from "react-map-gl/mapbox"
import worldGeojson from "@/assets/world-countries-110m.geojson"

interface WorldOverlayLayerProps {
  visitedIso2: Set<string>
}

const SOURCE_ID = "world-overlay"
const FILL_LAYER_ID = "world-overlay-fill"
const OUTLINE_LAYER_ID = "world-overlay-outline"

export default function WorldOverlayLayer({ visitedIso2 }: WorldOverlayLayerProps) {
  const { current: mapRef } = useMap()
  const addedRef = useRef(false)

  useEffect(() => {
    const map = mapRef?.getMap()
    if (!map) return

    // No fetch, no async gap — the data is already in memory from the
    // static import, so this runs synchronously the instant the style
    // is ready. Removes the entire class of race condition we kept
    // hitting with the fetch-based version.
    const addLayers = () => {
      if (addedRef.current || map.getSource(SOURCE_ID)) return

      const initialVisited = Array.from(visitedIso2)

      map.addSource(SOURCE_ID, { type: "geojson", data: worldGeojson as any })
      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": "#1a1d24", "fill-opacity": 0.55 },
        filter: ["!", ["in", ["get", "ISO_A2"], ["literal", initialVisited]]],
      })
      map.addLayer({
        id: OUTLINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": "#333333", "line-width": 0.5 },
      })
      addedRef.current = true
    }

    if (map.isStyleLoaded()) {
      addLayers()
    } else {
      map.once("load", addLayers)
    }
    return () => {
      map.off("load", addLayers)
    }
  }, [mapRef, visitedIso2])

  useEffect(() => {
    const map = mapRef?.getMap()
    if (!map || !addedRef.current) return
    if (!map.getLayer(FILL_LAYER_ID)) return
    const visitedList = Array.from(visitedIso2)
    map.setFilter(FILL_LAYER_ID, ["!", ["in", ["get", "ISO_A2"], ["literal", visitedList]]])
  }, [visitedIso2, mapRef])

  return null
}
