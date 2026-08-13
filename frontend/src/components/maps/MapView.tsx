import { useRef, useState, useMemo, useEffect } from "react"
import Map from "react-map-gl/mapbox"
import MapControllers from "@/components/maps/MapControllers"
import PinsList from "@/components/pins/PinList"
import PlacesLayers from "@/components/maps/PlacesLayers"
import LocationMarker from "@/components/maps/LocationMarker"
import UnlockStatusBanner from "@/components/maps/UnlockStatusBanner"
import type { RecenterMapControl } from "@/components/maps/RecenterMapControl"
import { usePins } from "@/context/usePins"
import { useLocationTracking } from "@/hooks/useLocationTracking"
import { useAutoUnlock } from "@/hooks/useAutoUnlock"
import { useCountryPlaces } from "@/hooks/useCountryPlaces"
import { useUnlockedPlaces } from "@/hooks/useUnlockedPlaces"
import { placesToGeoJson } from "@/lib/placesToGeoJson"
import { Loader2 } from "lucide-react"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export default function MapView() {
  const mapRef = useRef<any>(null)
  const recenterControlRef = useRef<RecenterMapControl | null>(null)
  const [zoom, setZoom] = useState(12)
  const [isCentered, setIsCentered] = useState(false)
  const { secondaryPanel, setSecondaryPanel, flyToTarget, setFlyToTarget } = usePins()

  const { location, iso2, status: trackingStatus, error: trackingError } = useLocationTracking()
  const { places, status: countryStatus } = useCountryPlaces(iso2)
  const { unlocked, refetch: refetchUnlocked } = useUnlockedPlaces()
  const unlockedIds = useMemo(() => new Set(unlocked.map((u) => u.placeId)), [unlocked])
  const { result, error: unlockError } = useAutoUnlock(location, places, countryStatus, unlockedIds, refetchUnlocked)

  useMemo(() => {
    if (!flyToTarget || !mapRef.current) return
    const map = mapRef.current.getMap()
    map.flyTo({ center: [flyToTarget.longitude, flyToTarget.latitude], zoom: 15, duration: 1200 })
    setFlyToTarget(null)
  }, [flyToTarget, setFlyToTarget])

  async function handleMapClick(e: any) {
    const { lat, lng } = e.lngLat
    try {
      const response = await fetch(
        `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&access_token=${MAPBOX_TOKEN}`
      )
      const data = await response.json()
      const feature = data.features?.[0]
      if (!feature) return
      setSecondaryPanel({
        type: "preview",
        placeName: feature.properties.name,
        address: feature.properties.full_address ?? feature.properties.place_formatted,
        lat,
        lng,
      })
    } catch (err) {
      console.error("Reverse geocode failed:", err)
    }
  }

  function handleRecenter() {
    if (!location || !mapRef.current) return
    setIsCentered(true)
    mapRef.current.getMap().flyTo({
      center: [location.longitude, location.latitude],
      zoom: 15,
      duration: 1500,
      easing: (t: number) => 1 - Math.pow(1 - t, 3), // ease-out cubic
    })
  }

  function handleDragStart() {
    if (isCentered) setIsCentered(false)
  }

  // Keep the native control's visual state (spin/highlight) in sync with React state
  useEffect(() => {
    recenterControlRef.current?.setState({
      locating: trackingStatus === "locating",
      centered: isCentered,
    })
  }, [trackingStatus, isCentered])

  const geojson = useMemo(() => {
    if (!places || countryStatus !== "cached") return null
    return placesToGeoJson(places, unlocked)
  }, [places, unlocked, countryStatus])

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude: 38.7578, latitude: 9.0192, zoom: 12 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        onZoom={(e) => setZoom(e.viewState.zoom)}
        onClick={handleMapClick}
        onDragStart={handleDragStart}
      >
        <LocationMarker location={location} />
        {geojson && <PlacesLayers geojson={geojson} />}
        <MapControllers mapRef={mapRef} onRecenterClick={handleRecenter} recenterControlRef={recenterControlRef} />
        <PinsList zoom={zoom} />
      </Map>
      {(countryStatus === "fetching" || trackingStatus === "locating") && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-background/90 backdrop-blur border rounded-lg px-4 py-2 shadow-lg flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="text-sm">
            {trackingStatus === "locating" ? "Finding your location..." : "Fetching information for this area..."}
          </p>
        </div>
      )}
      <UnlockStatusBanner result={result} error={unlockError ?? trackingError} />
    </div>
  )
}
