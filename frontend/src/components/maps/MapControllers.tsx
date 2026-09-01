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

// The native GeolocateControl only toggles between "live" (dot + pulsing
// accuracy circle + camera follows) and "off", so the user never gets the
// middle state where the dot stays but the circle is gone. We intercept the
// button (capture-phase listener on the control's container, which runs before
// the native click handler) and drive the control through the 3-stage cycle:
//
//   1. click  → live:   show the dot + blue accuracy circle, camera follows
//   2. click  → dot:    drop the circle, keep the dot, stop following
//   3. click  → off:    remove both, stop the GPS watcher
//
// Stage reads/writes the control's private fields (_watchState, _clearWatch,
// _accuracyCircleMarker, …). That's pinned to mapbox-gl@3.26 — the version
// locked in package.json — so these internals are stable for this app.
function attachGeolocateCycle(ctrl: any) {
  const container = ctrl._container as HTMLElement
  container.addEventListener(
    "click",
    (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest?.(".mapboxgl-ctrl-geolocate")) return
      // Suppress the native handler (it binds trigger(), which would skip the
      // middle stage and jump straight from live back to off).
      e.stopImmediatePropagation()
      e.preventDefault()

      const state: string = ctrl._watchState
      if (state === "BACKGROUND" || state === "BACKGROUND_ERROR") {
        // Stage 3 — remove dot + circle and stop the watcher (mirrors the
        // native OFF path in trigger()).
        ctrl._numberOfWatches--
        ctrl._noTimeout = false
        ctrl._setWatchState("OFF")
        if (ctrl._geolocationWatchID !== undefined) ctrl._clearWatch()
        ctrl.options.showAccuracyCircle = true
        ctrl.fire("trackuserlocationend")
      } else if (
        state === "ACTIVE_LOCK" ||
        state === "WAITING_ACTIVE" ||
        state === "ACTIVE_ERROR"
      ) {
        // Stage 2 — keep the dot, drop the accuracy circle, stop following.
        // The watcher keeps running, so the dot still tracks the user; we just
        // hide the circle so it isn't re-added on the next fix.
        ctrl._setWatchState("BACKGROUND")
        ctrl.options.showAccuracyCircle = false
        ctrl._accuracyCircleMarker?.remove()
        ctrl.fire("trackuserlocationend")
      } else {
        // Stage 1 — show the location: dot + circle, camera follows.
        ctrl.trigger()
      }
    },
    true
  )
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
      map.addControl(new mapboxgl.FullscreenControl(), "top-right")

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

      // Replace the native 2-state button toggle with the 3-stage cycle. The
      // control starts OFF — the location dot/circle only appears on the first
      // click (this also means the app's GPS feed starts on first click, not
      // on page load).
      attachGeolocateCycle(geolocateControl)
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
