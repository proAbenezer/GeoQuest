import { Marker } from "react-map-gl/mapbox"

export default function LocationMarker({
  location,
}: {
  location: { latitude: number; longitude: number } | null
}) {
  if (!location) return null
  return (
    <Marker longitude={location.longitude} latitude={location.latitude} anchor="center">
      <div className="relative flex items-center justify-center">
        <span className="absolute inline-flex h-6 w-6 rounded-full bg-emerald-500/30 border border-emerald-400/50" />
        <div className="relative rounded-full h-4 w-4 bg-emerald-500 border-2 border-white shadow-lg" />
      </div>
    </Marker>
  )
}
