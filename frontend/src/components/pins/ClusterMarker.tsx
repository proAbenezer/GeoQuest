// components/map/ClusterMarker.tsx
import { useState } from "react"
import { Marker } from "react-map-gl/mapbox"
import type { Pin as PinType } from "@/types"
import { usePins } from "@/context/usePins"
import type { MapboxEvent } from "react-map-gl/mapbox"

interface ClusterMarkerProps {
  pins: PinType[]
  latitude: number
  longitude: number
  zoom: number
}

const ClusterMarker = ({ pins, latitude, longitude, zoom }: ClusterMarkerProps) => {
  const { setSecondaryPanel, setFlyToTarget } = usePins()
  const [expanded, setExpanded] = useState(false)

  const hasImages = pins.some(p => p.imageUrl)
  const visitedCount = pins.filter(p => p.visited).length

  const handleClick = (e: MapboxEvent<MouseEvent>) => {
    e.originalEvent.stopPropagation()
    
    // If zoomed out, zoom in to the cluster
    if (zoom < 13) {
      setFlyToTarget({ latitude, longitude })
      return
    }
    
    // If zoomed in, show the pins in the cluster
    setExpanded(!expanded)
  }

  return (
    <Marker longitude={longitude} latitude={latitude} onClick={handleClick}>
      <div className="relative group">
        <div
          className={`
            flex items-center justify-center rounded-full shadow-lg
            transition-all duration-200 cursor-pointer
            ${hasImages 
              ? "bg-gradient-to-br from-green-400 to-blue-500" 
              : "bg-primary"
            }
            hover:scale-110
          `}
          style={{
            width: expanded ? "auto" : "40px",
            height: expanded ? "auto" : "40px",
            minWidth: expanded ? "160px" : "40px",
            padding: expanded ? "8px" : "0",
          }}
        >
          {expanded ? (
            <div className="grid grid-cols-3 gap-1 p-1 bg-background/95 backdrop-blur rounded-lg">
              {pins.slice(0, 6).map(pin => (
                <div
                  key={pin.id}
                  className="relative w-12 h-12 rounded overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSecondaryPanel({ type: "pinDetail", pin })
                  }}
                >
                  {pin.imageUrl ? (
                    <img
                      src={pin.imageUrl}
                      alt={pin.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  {pin.visited && (
                    <div className="absolute top-0 right-0 h-2 w-2 bg-[#D97B29] rounded-full" />
                  )}
                </div>
              ))}
              {pins.length > 6 && (
                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-xs font-medium">
                  +{pins.length - 6}
                </div>
              )}
            </div>
          ) : (
            <>
              <span className="text-white font-bold text-sm">{pins.length}</span>
              {hasImages && (
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-400 ring-2 ring-background" />
              )}
            </>
          )}
        </div>
        
        {/* Tooltip on hover */}
        {!expanded && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap
                        pointer-events-none">
            {pins.length} pins · {visitedCount} visited
          </div>
        )}
      </div>
    </Marker>
  )
}

export default ClusterMarker
