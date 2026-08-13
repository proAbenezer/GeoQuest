import { useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"

interface Location {
  latitude: number
  longitude: number
  accuracy?: number
}

interface MapControllersProps {
  mapRef: React.RefObject<any>
  onLocationUpdate: (loc: Location) => void
  onStatusChange: (status: "idle" | "locating" | "error") => void
  onError: (err: GeolocationPositionError | Error) => void
  geolocateControlRef: React.MutableRefObject<mapboxgl.GeolocateControl | null>
}

export default function MapControllers({
  mapRef,
  onLocationUpdate,
  onStatusChange,
  onError,
  geolocateControlRef,
}: MapControllersProps) {
  const initializedRef = useRef(false)

  const onLocationUpdateRef = useRef(onLocationUpdate)
  const onStatusChangeRef = useRef(onStatusChange)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate
    onStatusChangeRef.current = onStatusChange
    onErrorRef.current = onError
  }, [onLocationUpdate, onStatusChange, onError])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const setupControls = () => {
      if (initializedRef.current) return
      initializedRef.current = true

      map.addControl(new mapboxgl.NavigationControl(), "top-right")
      map.addControl(new mapboxgl.FullscreenControl(), "top-right");(window as any).__debugMap = map

      const geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
        fitBoundsOptions: { maxZoom: 15 },
      })

      geolocateControl.on("geolocate", (e: GeolocationPosition) => {
        onLocationUpdateRef.current({
          latitude: e.coords.latitude,
          longitude: e.coords.longitude,
          accuracy: e.coords.accuracy,
        })
      })
      geolocateControl.on("trackuserlocationstart", () => onStatusChangeRef.current("locating"))
      geolocateControl.on("trackuserlocationend", () => onStatusChangeRef.current("idle"))
      geolocateControl.on("error", (e: GeolocationPositionError) => onErrorRef.current(e))

      map.addControl(geolocateControl, "top-right")
      geolocateControlRef.current = geolocateControl

      map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left")

      // GeolocateControl isn't fully attached in the same tick as addControl —
      // triggering immediately throws "Geolocate control triggered before added to a map".
      setTimeout(() => {
        geolocateControl.trigger()
      }, 0)
    }

    if (map.isStyleLoaded()) {
      setupControls()
    } else {
      map.once("load", setupControls)
    }

    return () => {
      if (map) map.off("load", setupControls)
    }
  }, [mapRef, geolocateControlRef])

  return null
}
