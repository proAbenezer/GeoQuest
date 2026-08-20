// components/pins/PinsListWithClustering.tsx
import { useMemo } from "react"
import { usePins } from "@/context/usePins"
import PinMarker from "@/components/map/PinMarker"
import ClusterMarker from "@/components/map/ClusterMarker"

interface PinsListProps {
  zoom: number
}

const CLUSTER_ZOOM_THRESHOLD = 11

const PinsListWithClustering = ({ zoom }: PinsListProps) => {
  const { pins } = usePins()

  // Cluster pins when zoomed out
  const clusteredPins = useMemo(() => {
    if (zoom >= CLUSTER_ZOOM_THRESHOLD || pins.length < 20) {
      return pins.map(pin => ({ type: 'pin' as const, pin }))
    }

    const gridSize = 0.01 / Math.pow(2, zoom - 10)
    const clusters = new Map<string, typeof pins>()

    pins.forEach(pin => {
      const key = `${Math.floor(pin.latitude / gridSize)},${Math.floor(pin.longitude / gridSize)}`
      if (!clusters.has(key)) {
        clusters.set(key, [])
      }
      clusters.get(key)!.push(pin)
    })

    const result: Array<{ type: 'pin'; pin: typeof pins[0] } | { type: 'cluster'; pins: typeof pins; lat: number; lng: number }> = []

    clusters.forEach((clusterPins) => {
      if (clusterPins.length === 1) {
        result.push({ type: 'pin', pin: clusterPins[0] })
      } else {
        const avgLat = clusterPins.reduce((sum, p) => sum + p.latitude, 0) / clusterPins.length
        const avgLng = clusterPins.reduce((sum, p) => sum + p.longitude, 0) / clusterPins.length
        result.push({ type: 'cluster', pins: clusterPins, lat: avgLat, lng: avgLng })
      }
    })

    return result
  }, [pins, zoom])

  return (
    <>
      {clusteredPins.map((item) => {
        if (item.type === 'pin') {
          return <PinMarker key={item.pin.id} pin={item.pin} zoom={zoom} />
        } else {
          return (
            <ClusterMarker
              key={`cluster-${item.lat}-${item.lng}`}
              pins={item.pins}
              latitude={item.lat}
              longitude={item.lng}
              zoom={zoom}
            />
          )
        }
      })}
    </>
  )
}

export default PinsListWithClustering
