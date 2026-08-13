import { useRef, useState, useMemo } from "react"
import Map from "react-map-gl/mapbox"
import mapboxgl from "mapbox-gl"
import MapControllers from "@/components/maps/MapControllers"
import PinsList from "@/components/pins/PinList"
import PlacesLayers from "@/components/maps/PlacesLayers"
import WorldOverlayLayer from "@/components/maps/WorldOverlayLayer"
import UnlockStatusBanner from "@/components/maps/UnlockStatusBanner"
import { usePins } from "@/context/usePins"
import { useLocationTracking } from "@/hooks/useLocationTracking"
import { useAutoUnlock } from "@/hooks/useAutoUnlock"
import { useVisitedCountriesPlaces } from "@/hooks/useVisitedCountriesPlaces"
import { useUnlockedPlaces } from "@/hooks/useUnlockedPlaces"
import { placesToGeoJson } from "@/lib/placesToGeoJson"
import { Loader2 } from "lucide-react"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export default function MapView() {
  const mapRef = useRef<any>(null)
  const geolocateControlRef = useRef<mapboxgl.GeolocateControl | null>(null)
  const [zoom, setZoom] = useState(12)
  const { secondaryPanel, setSecondaryPanel, flyToTarget, setFlyToTarget } = usePins()

  const {
    location,
    iso2,
    status: trackingStatus,
    error: trackingError,
    handleLocationUpdate,
    handleStatusChange,
    handleError,
  } = useLocationTracking()

  // unlocked must be declared BEFORE useVisitedCountriesPlaces, since that
  // hook needs it to compute which countries have real unlock progress.
  const { unlocked, refetch: refetchUnlocked } = useUnlockedPlaces()

  const { places: allPlaces, visitedIso2, currentCountryStatus } = useVisitedCountriesPlaces(iso2, unlocked)

  const unlockedIds = useMemo(() => new Set(unlocked.map((u) => u.placeId)), [unlocked])
  const { result, error: unlockError } = useAutoUnlock(
    location,
    allPlaces,
    currentCountryStatus,
    unlockedIds,
    refetchUnlocked
  )

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

  const geojson = useMemo(() => {
    if (!allPlaces.length) return null
    return placesToGeoJson(allPlaces, unlocked)
  }, [allPlaces, unlocked])

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
      >
        <WorldOverlayLayer visitedIso2={visitedIso2} />
        {geojson && <PlacesLayers geojson={geojson} />}
        <MapControllers
          mapRef={mapRef}
          onLocationUpdate={handleLocationUpdate}
          onStatusChange={handleStatusChange}
          onError={handleError}
          geolocateControlRef={geolocateControlRef}
        />
        <PinsList zoom={zoom} />
      </Map>
      {(currentCountryStatus === "fetching" || trackingStatus === "locating") && (
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
