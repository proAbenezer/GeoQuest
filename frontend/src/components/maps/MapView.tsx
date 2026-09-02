// components/maps/MapView.tsx
import Map from "react-map-gl/mapbox"
import type * as mapboxgl from "mapbox-gl"
import MapControllers from "@/components/maps/MapControllers"
import { useRef, useState, useMemo, useEffect, useCallback } from "react"
import PinsList from "@/components/pins/PinList"
import PlacesLayers from "@/components/maps/PlacesLayers"
import CommentRoutesLayer from "@/components/maps/CommentRoutesLayer"
import UnlockStatusBanner from "@/components/maps/UnlockStatusBanner"
import { usePins } from "@/context/usePins"
import { usePanelManager } from "@/hooks/usePanelManager"
import { useRecentlyVisited } from "@/hooks/useRecentlyVisited"
import { useLocationTracking } from "@/hooks/useLocationTracking"
import { useAutoUnlock } from "@/hooks/useAutoUnlock"
import { useVisitedCheckin } from "@/hooks/useVisitedCheckin"
import { useVisitedCountriesPlaces } from "@/hooks/useVisitedCountriesPlaces"
import { useUnlockedPlaces } from "@/hooks/useUnlockedPlaces"
import { placesToGeoJson } from "@/lib/placesToGeoJson"
import { reverseGeocodeClick } from "@/lib/reverseGeocode"
import { osmNearestNamed, poiLabelAt } from "@/lib/poiFromClick"
import TopCommentWidget from "@/components/comments/TopCommentWidget"
import { Loader2, Route as RouteIcon } from "lucide-react"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

type Center = { latitude: number; longitude: number }

// Fallback country for the exploration bar. The geolocate control starts OFF
// (GPS only begins on first click), so until the user shares their location
// `iso2` is null and the bar would otherwise sit at "Exploring… –". While GPS
// is unknown, reverse-geocode the map's viewport center instead — the
// exploration bar follows what's on screen (pan to another country, see its
// progress). GPS, once available, always wins and clears the fallback.
function useViewportCountry(
  gpsIso2: string | null,
  center: Center | null
): string | null {
  const [iso2, setIso2] = useState<string | null>(null)

  // GPS arriving (or never existing) resets any stale viewport-derived code.
  useEffect(() => {
    if (gpsIso2) setIso2(null)
  }, [gpsIso2])

  useEffect(() => {
    if (gpsIso2 || !center) return
    let cancelled = false
    // Debounce: the center updates on every pan/zoom end.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${center.longitude}&latitude=${center.latitude}&types=country&access_token=${MAPBOX_TOKEN}`
        )
        const data = await res.json()
        const code = data.features?.[0]?.properties?.context?.country?.country_code
        if (!cancelled && code) setIso2(code.toUpperCase())
      } catch (err) {
        console.error("Viewport country reverse-geocode failed:", err)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [gpsIso2, center])

  return iso2
}

export default function MapView() {
  const mapRef = useRef<any>(null)
  const geolocateControlRef = useRef<mapboxgl.GeolocateControl | null>(null)
  // Aborts the previous click's OpenStreetMap lookup when a new click lands, so
  // a stale answer can never overwrite the current one.
  const osmAbortRef = useRef<AbortController | null>(null)
  const [zoom, setZoom] = useState(12)
  const [showCommentRoutes, setShowCommentRoutes] = useState(true)
  const [commentRouteCount, setCommentRouteCount] = useState(0)
  const {
    flyToTarget,
    setFlyToTarget,
    setMapBounds,
    setViewportCenter,
    viewportCenter,
    setGpsLocation,
    setCountryIso2,
    bumpUnlockCount,
    setSecondaryPanel,
    setHighlightedPinId,
    setSelectedRoute,
    openCommentView,
  } = usePins()
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

  // GPS proximity check-in: marks the current identity's pins as visited when
  // the existing location fix comes within range (reuses `location` above).
  useVisitedCheckin(location)

  const { places: allPlaces, currentCountryStatus } = useVisitedCountriesPlaces(iso2, unlocked)

  const unlockedIds = useMemo(() => new Set(unlocked.map((u) => u.placeId)), [unlocked])
  
  const { result, error: unlockError, checking } = useAutoUnlock(
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
      // Tell the exploration bar that persisted roll-up data changed, so it
      // re-reads it from the server (the server recomputes on write).
      bumpUnlockCount()
    }
  }, [result, bumpUnlockCount])

  // Feed the sidebar's exploration bar the current country. iso2 is derived by
  // THIS component's location watcher (the only one in the app) — the sidebar
  // consumes it through context instead of running its own reverse-geocode.
  // Until GPS resolves (the geolocate control starts off), fall back to the
  // country under the viewport center so the bar shows a percentage right away.
  const viewportCountryIso2 = useViewportCountry(iso2, viewportCenter)
  useEffect(() => {
    setCountryIso2(iso2 ?? viewportCountryIso2 ?? null)
  }, [iso2, viewportCountryIso2, setCountryIso2])

  // Mirror the live GPS fix into context so the exploration bar can anchor to
  // the region the user is physically in, not the arbitrary viewport centre.
  useEffect(() => {
    setGpsLocation(
      location ? { latitude: location.latitude, longitude: location.longitude } : null
    )
  }, [location, setGpsLocation])

  useEffect(() => {
    if (!flyToTarget || !mapRef.current) return
    const map = mapRef.current.getMap()
    map.flyTo({ center: [flyToTarget.longitude, flyToTarget.latitude], zoom: 15, duration: 1200 })
    setFlyToTarget(null)
  }, [flyToTarget, setFlyToTarget])

  const updateBounds = useCallback(() => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap()
    const b = map.getBounds()
    setMapBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
    // Phase 2: feed the top-comment widget the current viewport center so it
    // can find the nearest comment-bearing location (pan/zoom only — GPS and
    // pin clicks don't touch this).
    const center = map.getCenter()
    setViewportCenter({ latitude: center.lat, longitude: center.lng })
  }, [setMapBounds, setViewportCenter])

  // Ask OpenStreetMap for the nearest named POI, but only within ~1.5s: past
  // that, the click resolves to the reverse-geocoded area name instead. Aborts
  // any previous request so rapid clicks don't queue stale lookups.
  const osmNearestNamedWithin = async (latitude: number, longitude: number) => {
    osmAbortRef.current?.abort()
    const controller = new AbortController()
    osmAbortRef.current = controller
    const timer = setTimeout(() => controller.abort(), 1500)
    try {
      return await osmNearestNamed(latitude, longitude, controller.signal)
    } catch {
      return null
    } finally {
      clearTimeout(timer)
      if (osmAbortRef.current === controller) osmAbortRef.current = null
    }
  }

  async function handleMapClick(e: any) {
    // Comment-route lines are a canvas layer, so a click on one never reaches
    // the HTML badge markers — detect it here via queryRenderedFeatures and
    // open the route-comment panel instead of reverse-geocoding the point.
    const map = mapRef.current?.getMap()
    if (map) {
      // The route overlay only exists while routes are visible (CommentRoutesLayer
      // renders nothing otherwise), and queryRenderedFeatures *throws* — it doesn't
      // return empty — when a named layer is absent from the style. Query only the
      // layers that currently exist so a bare map click is never aborted before the
      // reverse-geocode below runs.
      const routeLayers = ["comment-routes-line", "comment-routes-casing"].filter(
        (id) => map.getLayer(id)
      )
      if (routeLayers.length > 0) {
        try {
          const hit = map.queryRenderedFeatures(e.point, { layers: routeLayers })
          if (hit.length > 0) {
            const props = hit[0].properties
            if (props?.routeStartPinId && props?.routeEndPinId) {
              e.originalEvent?.stopPropagation?.()
              // Selecting a route drives the comment widget (no side panel): close
              // any open panels, deselect any highlighted pin, and mark the route.
              setHighlightedPinId(null)
              openCommentView(false)
              setSecondaryPanel(null)
              setSelectedRoute({
                routeStartPinId: props.routeStartPinId,
                routeEndPinId: props.routeEndPinId,
              })
              return
            }
          }
        } catch (err) {
          console.error("Route line query failed:", err)
        }
      }
    }

    const { lat, lng } = e.lngLat

    // Kick off the address/area lookup immediately — it runs while the exact-name
    // sources below are checked.
    const areaPromise = reverseGeocodeClick(lat, lng).catch((err) => {
      console.error("Reverse geocode failed:", err)
      return null
    })

    // Exact name, best source first: mapbox's own POI label under the cursor
    // (reads the tiles already on screen — synchronous), else the nearest named
    // OpenStreetMap POI (capped ~1.5s so a slow answer can't hang the click).
    // Reverse geocoding can never return a POI, so both are needed to get past
    // the street name.
    const label = poiLabelAt(map, e.point)
    const osm = label ? null : await osmNearestNamedWithin(lat, lng)
    const precise = label ?? osm

    // Administrative context: the address line, plus the street/sub-city/city
    // fallback when neither POI source found anything to name.
    const area = await areaPromise
    const placeName = precise?.name ?? area?.placeName ?? ""
    const address = area?.address ?? ""
    if (!placeName) return

    trackVisitedPlace({
      placeId: precise?.id ?? area?.placeId ?? `place_${lat.toFixed(5)},${lng.toFixed(5)}`,
      name: placeName,
      address,
      latitude: lat,
      longitude: lng,
    })

    openPreview({
      placeName,
      address,
      lat,
      lng,
    })
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
          const node = el as HTMLElement
          node.style.border = 'none';
          node.style.outline = 'none';
          node.style.boxShadow = 'none';
          node.style.borderStyle = 'none';
          node.style.borderWidth = '0';
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
        <CommentRoutesLayer
          visible={showCommentRoutes}
          zoom={zoom}
          onCountChange={setCommentRouteCount}
        />
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
        <div className="absolute top-[max(1.5rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-20 bg-background/90 backdrop-blur border rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 max-w-[calc(100%-2rem)]">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <p className="text-sm truncate">
            {trackingStatus === "locating" ? "Finding your location..." : "Fetching information for this area..."}
          </p>
        </div>
      )}
      <UnlockStatusBanner result={result} error={unlockError ?? trackingError} checking={checking} />

      {/* Route-comments toggle — the discoverable control for the route overlay.
          Only appears once a route has comments, and stays visible when hidden
          so it can be toggled back on. */}
      {commentRouteCount > 0 && (
        <button
          type="button"
          onClick={() => setShowCommentRoutes((v) => !v)}
          aria-pressed={showCommentRoutes}
          title={
            showCommentRoutes
              ? "Hide comment routes on the map"
              : "Show comment routes on the map"
          }
          className={`
            absolute bottom-8 left-3 z-30 flex items-center gap-2 rounded-full border px-3 py-2 shadow-xl backdrop-blur transition-colors
            supports-[backdrop-filter]:bg-background/80
            ${showCommentRoutes
              ? "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25"
              : "border-border/60 bg-background/95 text-muted-foreground hover:bg-muted/40"
            }
          `}
        >
          <RouteIcon className="h-4 w-4" />
          <span className="text-xs font-semibold">Routes</span>
          <span
            className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
            aria-label={`${commentRouteCount} commented route${commentRouteCount === 1 ? "" : "s"}`}
          >
            {commentRouteCount > 9 ? "9+" : commentRouteCount}
          </span>
        </button>
      )}

      <TopCommentWidget />
    </div>
  )
}
