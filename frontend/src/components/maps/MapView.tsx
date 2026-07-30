import { useRef, useState, useEffect } from "react"
import Map, { Source, Layer, Marker } from "react-map-gl/mapbox"
import MapControllers from "@/components/maps/MapControllers"
import PinsList from "@/components/pins/PinList"
import { usePins } from "@/context/usePins"
import { useUnlockDistrict } from "@/hooks/useUnlockDistrict"
import { useDistrictsGeoJson } from "@/hooks/useDistrictsGeoJson"
import { Button } from "@/components/ui/button"
import { MapPin, Loader2 } from "lucide-react"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export default function MapView() {
  const mapRef = useRef<any>(null)
  const [zoom, setZoom] = useState(12)
  const { secondaryPanel, setSecondaryPanel, flyToTarget, setFlyToTarget } =
    usePins()

  const { data: districtsGeoJson, refetch: refetchDistricts } = useDistrictsGeoJson()

  const { checkIn, status, result, error, currentLocation } = useUnlockDistrict({
    onSuccess: refetchDistricts,
  })

  // Handle flyTo targets from pins selection
  useEffect(() => {
    if (!flyToTarget || !mapRef.current) return
    const map = mapRef.current.getMap()
    map.flyTo({
      center: [flyToTarget.longitude, flyToTarget.latitude],
      zoom: 15,
      duration: 1200,
    })
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
        address:
          feature.properties.full_address ?? feature.properties.place_formatted,
        lat,
        lng,
      })
    } catch (err) {
      console.error("Reverse geocode failed:", err)
    }
  }

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: 38.7578,
          latitude: 9.0192,
          zoom: 12,
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        onZoom={(e) => setZoom(e.viewState.zoom)}
        onClick={handleMapClick}
      >
        {/* Steady location dot */}
        {currentLocation && (
          <Marker
            longitude={currentLocation.longitude}
            latitude={currentLocation.latitude}
            anchor="center"
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-6 w-6 rounded-full bg-emerald-500/30 border border-emerald-400/50" />
              <div className="relative rounded-full h-4 w-4 bg-emerald-500 border-2 border-white shadow-lg" />
            </div>
          </Marker>
        )}

        {/* District GeoJSON overlay */}
        {districtsGeoJson && (
          <Source id="districts" type="geojson" data={districtsGeoJson}>
            <Layer
              id="districts-locked-fill"
              type="fill"
              filter={["==", ["get", "unlocked"], false]}
              paint={{
                "fill-color": "#000000",
                "fill-opacity": 0.7,
              }}
            />
            <Layer
              id="districts-unlocked-outline"
              type="line"
              filter={["==", ["get", "unlocked"], true]}
              paint={{
                "line-color": "#22c55e",
                "line-width": 2,
              }}
            />
          </Source>
        )}

        <MapControllers mapRef={mapRef} />
        <PinsList zoom={zoom} />
      </Map>

      {/* Action panel at the bottom */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        <Button
          onClick={checkIn}
          disabled={status === "loading"}
          size="lg"
          className="shadow-lg font-semibold gap-2"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking location...
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4" />
              Check in here
            </>
          )}
        </Button>

        {result?.unlocked && (
          <div className="bg-background/90 backdrop-blur border rounded-lg px-4 py-2 shadow-lg">
            <p className="text-sm font-semibold">
              {result.alreadyUnlocked ? "Already unlocked: " : "🎉 Unlocked: "}
              <span className="text-primary">{result.district?.name}</span>
            </p>
          </div>
        )}
        {result && !result.unlocked && (
          <div className="bg-background/90 backdrop-blur border rounded-lg px-4 py-2 shadow-lg">
            <p className="text-sm text-muted-foreground">{result.reason}</p>
          </div>
        )}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2 shadow-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
