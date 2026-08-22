// components/maps/MapView.tsx
import Map from "react-map-gl/mapbox"
import mapboxgl from "mapbox-gl"
import MapControllers from "@/components/maps/MapControllers"
import { useRef, useState, useMemo, useEffect, useCallback } from "react"
import PinsList from "@/components/pins/PinList"
import PlacesLayers from "@/components/maps/PlacesLayers"
import UnlockStatusBanner from "@/components/maps/UnlockStatusBanner"
import { usePins } from "@/context/usePins"
import { usePanelManager } from "@/hooks/usePanelManager"
import { useRecentlyVisited } from "@/hooks/useRecentlyVisited"
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
  const { secondaryPanel, setSecondaryPanel, flyToTarget, setFlyToTarget, setMapBounds } = usePins()
  const { openPreview } = usePanelManager()
  
  const { trackVisitedPlace } = useRecentlyVisited()

  const {
    location,
    iso2,
    status: trackingStatus,
    error: trackingError,
    handleLocationUpdate,
    handleStatusChange,
    handleError,
  } = useLocationTracking()

  const { unlocked, refetch: refetchUnlocked } = useUnlockedPlaces()

  const { places: allPlaces, visitedIso2, currentCountryStatus } = useVisitedCountriesPlaces(iso2, unlocked)

  const unlockedIds = useMemo(() => new Set(unlocked.map((u) => u.placeId)), [unlocked])
  
  const { result, error: unlockError } = useAutoUnlock(
    location,
    allPlaces,
    currentCountryStatus,
    unlockedIds,
    refetchUnlocked,
    trackVisitedPlace
  )

  useEffect(() => {
    if (result?.unlocked && !result.alreadyUnlocked && result?.place) {
      console.log('Place unlocked:', result.place.name)
    }
  }, [result])

  useEffect(() => {
    if (!flyToTarget || !mapRef.current) return
    const map = mapRef.current.getMap()
    map.flyTo({ center: [flyToTarget.longitude, flyToTarget.latitude], zoom: 15, duration: 1200 })
    setFlyToTarget(null)
  }, [flyToTarget, setFlyToTarget])

  // ---- NEW: update map bounds on load and move ----
  const updateBounds = useCallback(() => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap()
    const b = map.getBounds()
    setMapBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
  }, [setMapBounds])

  async function handleMapClick(e: any) {
    const { lat, lng } = e.lngLat
    try {
      const response = await fetch(
        `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&access_token=${MAPBOX_TOKEN}`
      )
      const data = await response.json()
      const feature = data.features?.[0]
      if (!feature) return

      const placeId = feature.properties.mapbox_id || feature.id || `place_${Date.now()}`
      const placeName = feature.properties.name || "Unknown Place"
      const placeAddress = feature.properties.full_address || feature.properties.place_formatted || placeName

      trackVisitedPlace({
        placeId: placeId,
        name: placeName,
        address: placeAddress,
        latitude: lat,
        longitude: lng,
      })

      openPreview({
        placeName: placeName,
        address: placeAddress,
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

  // Force remove borders after map loads
  useEffect(() => {
    const removeBorders = () => {
      document.querySelectorAll('.mapboxgl-map, .mapboxgl-canvas-container, .mapboxgl-canvas, .map-wrapper, .map-container')
        .forEach(el => {
          el.style.border = 'none';
          el.style.outline = 'none';
          el.style.boxShadow = 'none';
          el.style.borderStyle = 'none';
          el.style.borderWidth = '0';
        });
    };
    
    removeBorders();
    setTimeout(removeBorders, 500);
    setTimeout(removeBorders, 1000);
  }, []);

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
        onLoad={updateBounds}
        onMoveEnd={updateBounds}
      >
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
