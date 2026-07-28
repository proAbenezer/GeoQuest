import { MapPin } from "lucide-react"
import type { SelectedLocation } from "@/types/location"

const LocationPreview = ({
  location,
}: {
  location: SelectedLocation | null
}) => (
  <div className="rounded-lg border bg-muted/30 p-4">
    <div className="mb-3 flex items-center gap-2">
      <MapPin className="h-4 w-4 text-[#D97B29]" />
      <span className="text-sm font-medium">Location</span>
    </div>
    {location ? (
      <div className="space-y-2 text-sm">
        <p className="font-medium">{location.placeName}</p>
        <p className="text-muted-foreground">{location.address}</p>
        <p>Latitude: {location.latitude.toFixed(6)}</p>
        <p>Longitude: {location.longitude.toFixed(6)}</p>
      </div>
    ) : (
      <p className="text-xs text-muted-foreground">
        Search for a location first.
      </p>
    )}
  </div>
)

export default LocationPreview
