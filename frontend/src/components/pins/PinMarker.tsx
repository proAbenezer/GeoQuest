// components/maps/PinMarker.tsx
import { useState } from "react"
import { MapPin, CheckCircle2 } from "lucide-react"
import { Marker } from "react-map-gl/mapbox"
import { usePins } from "@/context/usePins"
import { IconStack } from "@/components/ui/icon-stack"
import { getIconList, getCategoryIcon } from "@/lib/categoryDisplay"
import type { Pin } from "@/types"

interface PinMarkerProps {
  pin: Pin
  zoom: number
  /** Total comments on the pin (incl. routes it's an endpoint of); >0 shows a badge. */
  commentCount?: number
}

const MIN_ZOOM_TO_SHOW_PINS = 12
const MIN_ZOOM_TO_SHOW_IMAGES = 13

const PinMarker = ({ pin, zoom, commentCount }: PinMarkerProps) => {
  // ✅ ALL HOOKS AT THE TOP
  const {
    setSecondaryPanel,
    setFlyToTarget,
    setHighlightedPinId,
    highlightedPinId,
  } = usePins()
  
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // ✅ VALIDATE PIN DATA AFTER HOOKS
  if (!pin || !pin.id) {
    console.warn("PinMarker: Invalid pin data", pin)
    return null
  }

  if (zoom < MIN_ZOOM_TO_SHOW_PINS) return null

  const isHighlighted = highlightedPinId === pin.id
  const hasImage = pin.imageUrl && !imageError
  const showImagePreview = zoom >= MIN_ZOOM_TO_SHOW_IMAGES && hasImage && isHovered

  const handleClick = (e: any) => {
    e.originalEvent?.stopPropagation?.()
    console.log("🔵 PinMarker clicked:", pin.id, pin.name)
    setSecondaryPanel({ type: "pinDetail", pin })
    setFlyToTarget({
      latitude: pin.latitude,
      longitude: pin.longitude,
    })
    setHighlightedPinId(pin.id)
  }

  return (
    <Marker
      longitude={pin.longitude}
      latitude={pin.latitude}
      onClick={handleClick}
    >
      <div
        className="relative group cursor-pointer transition-transform hover:scale-110"
        style={{
          transform: isHighlighted ? "scale(1.15)" : "scale(1)",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Main pin icon */}
        <div className="relative flex items-center justify-center">
          <MapPin
            size={pin.visited ? 28 : 22}
            strokeWidth={2.5}
            className={`
              transition-all duration-200 drop-shadow-lg
              ${isHighlighted
                ? "text-[#D97B29] filter drop-shadow-[0_0_8px_rgba(217,123,41,0.5)]"
                : pin.visited
                  ? "text-white"
                  : "text-white/40"
              }
            `}
            fill={pin.visited ? "#D97B29" : "none"}
          />

          {/* Small indicator dot for pins with images */}
          {hasImage && (
            <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-background animate-pulse" />
          )}

          {/* Comment-count badge (top-left; distinct from the green image dot). */}
          {typeof commentCount === "number" && commentCount > 0 && (
            <div className="absolute -top-1 -left-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-white ring-2 ring-background">
              {commentCount > 9 ? "9+" : commentCount}
            </div>
          )}
        </div>

        {/* Icon cluster for pins with icons */}
        {pin.icons && pin.icons.length > 0 && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex justify-center">
            <IconStack
              icons={getIconList(pin.icons, getCategoryIcon(pin.categoryId))}
              size="h-3.5 w-3.5"
              max={3}
              className="text-primary"
            />
          </div>
        )}

        {/* ✅ BIGGER SNAPCHAT-STYLE IMAGE PREVIEW ON HOVER */}
        {showImagePreview && (
          <div 
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 
                       transition-all duration-200 ease-out
                       pointer-events-none z-50"
            style={{
              opacity: isHovered ? 1 : 0,
              transform: `translateX(-50%) scale(${isHovered ? 1 : 0.85})`,
              transformOrigin: "bottom center",
            }}
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 bg-black/5 backdrop-blur-sm min-w-[160px]">
              {/* Loading skeleton */}
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60" />
                </div>
              )}
              
              {/* Image - BIGGER SIZE */}
              <img
                src={pin.imageUrl!}
                alt={pin.customName || pin.name}
                className={`
                  w-[180px] h-[180px] object-cover transition-opacity duration-300
                  ${imageLoaded ? "opacity-100" : "opacity-0"}
                `}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                loading="lazy"
              />
              
              {/* Gradient overlay with name - bigger text */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 py-2.5">
                <p className="text-sm font-semibold text-white truncate">
                  {pin.customName || pin.name}
                </p>
                {pin.visited && (
                  <p className="text-xs text-[#D97B29] font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Visited
                  </p>
                )}
              </div>
              
              {/* Visited badge on image */}
              {pin.visited && (
                <div className="absolute top-2 right-2 bg-[#D97B29] rounded-full p-1 shadow-lg">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mini preview at lower zoom - bigger size */}
        {hasImage && !showImagePreview && zoom >= MIN_ZOOM_TO_SHOW_PINS && (
          <div 
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5
                       w-8 h-8 rounded-full border-2 border-white/30 overflow-hidden
                       transition-all duration-200"
            style={{
              opacity: isHovered ? 1 : 0.5,
              transform: `translateX(-50%) scale(${isHovered ? 1.2 : 1})`,
            }}
          >
            <img
              src={pin.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </Marker>
  )
}

export default PinMarker
