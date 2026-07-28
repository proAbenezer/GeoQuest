import { MapPin } from "lucide-react"
import type { Pin as PinType } from "@/types"
import { Marker } from "react-map-gl/mapbox"
import { usePins } from "@/context/usePins"

interface PinProps {
  pin: PinType
  onSelect: (pin: PinType) => void
  zoom: number
}

const MIN_ZOOM_TO_SHOW_PINS = 12

const Pin = ({ pin, zoom }: PinProps) => {
  const {
    setSecondaryPanel,
    setFlyToTarget,
    setHighlightedPinId,
    highlightedPinId,
  } = usePins()
  const isHighlighted = highlightedPinId === pin.id

  if (zoom < MIN_ZOOM_TO_SHOW_PINS) return null

  return (
    <Marker
      longitude={pin.longitude}
      latitude={pin.latitude}
      onClick={() => {
        setSecondaryPanel({ type: "pinDetail", pin })
        setFlyToTarget({ latitude: pin.latitude, longitude: pin.longitude })
        setHighlightedPinId(pin.id)
      }}
    >
      <div
        className={
          pin.visited
            ? "flex h-10 w-10 cursor-pointer items-center justify-center transition-transform hover:scale-110"
            : "flex h-8 w-8 cursor-pointer items-center justify-center transition-transform hover:scale-110"
        }
      >
        <MapPin
          size={pin.visited ? 20 : 15}
          strokeWidth={2}
          className={
            isHighlighted
              ? "text-[#D97B29]"
              : pin.visited
                ? "text-white"
                : "text-white/35"
          }
        />
      </div>
    </Marker>
  )
}

export default Pin
