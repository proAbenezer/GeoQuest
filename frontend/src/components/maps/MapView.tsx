import { useRef, useState, useEffect } from "react"
import Map from "react-map-gl/mapbox"
import MapControllers from "@/components/maps/MapControllers"
import PinsList from "@/components/pins/PinList"
import { usePins } from "@/context/usePins"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export default function MapView() {
  const mapRef = useRef(null)
  const [zoom, setZoom] = useState(12)
  const { secondaryPanel, setSecondaryPanel, flyToTarget, setFlyToTarget } =
    usePins()

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

  async function handleMapClick(e: MapLayerMouseEvent) {
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
      <MapControllers mapRef={mapRef} />
      <PinsList zoom={zoom} />
    </Map>
  )
}
