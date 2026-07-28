import { useEffect } from "react"
import mapboxgl from "mapbox-gl"

const MapControllers = ({ mapRef }) => {
  useEffect(() => {
    const map = mapRef.current?.getMap()

    if (!map) return

    // Create controls
    const navigationControl = new mapboxgl.NavigationControl()
    const fullscreenControl = new mapboxgl.FullscreenControl()
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
      showUserHeading: true,
    })
    const scaleControl = new mapboxgl.ScaleControl({
      unit: "metric",
    })

    // Add controls
    map.addControl(navigationControl, "top-right")
    map.addControl(fullscreenControl, "top-right")
    map.addControl(geolocateControl, "top-right")
    map.addControl(scaleControl, "bottom-left")

    // Cleanup
    return () => {
      if (map.hasControl(navigationControl))
        map.removeControl(navigationControl)
      if (map.hasControl(fullscreenControl))
        map.removeControl(fullscreenControl)
      if (map.hasControl(geolocateControl)) map.removeControl(geolocateControl)
      if (map.hasControl(scaleControl)) map.removeControl(scaleControl)
    }
  }, [mapRef])

  return null
}

export default MapControllers
