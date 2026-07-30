import { useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"

interface MapControllersProps {
  mapRef: React.RefObject<any>
}

export default function MapControllers({ mapRef }: MapControllersProps) {
  const initializedRef = useRef(false)

  useEffect(() => {
    const map = mapRef.current?.getMap()

    // Safety check: if map isn't loaded yet, wait for 'load' event
    if (!map) return

    const setupControls = () => {
      // Prevent duplicate control initialization
      if (initializedRef.current) return
      initializedRef.current = true

      const navigationControl = new mapboxgl.NavigationControl()
      const fullscreenControl = new mapboxgl.FullscreenControl()
      const scaleControl = new mapboxgl.ScaleControl({ unit: "metric" })

      const geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
          timeout: 10000,
        },
        trackUserLocation: true,
        showUserHeading: true,
        showUserLocation: true,
      })

      map.addControl(navigationControl, "top-right")
      map.addControl(fullscreenControl, "top-right")
      map.addControl(geolocateControl, "top-right")
      map.addControl(scaleControl, "bottom-left")
    }

    if (map.isStyleLoaded()) {
      setupControls()
    } else {
      map.once("load", setupControls)
    }

    return () => {
      // Clean up map listeners on unmount
      if (map) {
        map.off("load", setupControls)
      }
    }
  }, [mapRef])

  return null
}
