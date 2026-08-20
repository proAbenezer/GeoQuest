// components/pins/PinList.tsx
import { usePins } from "@/context/usePins"
import PinMarker from "@/components/pins/PinMarker"

interface PinsListProps {
  zoom: number
}

const PinsList = ({ zoom }: PinsListProps) => {
  const { pins } = usePins()
  
  
  // Guard against undefined or empty
  if (!pins || pins.length === 0) {
    return null
  }

  // Sort: visited first, then images
  const sortedPins = [...pins].sort((a, b) => {
    if (a.visited && !b.visited) return -1
    if (!a.visited && b.visited) return 1
    if (a.imageUrl && !b.imageUrl) return -1
    if (!a.imageUrl && b.imageUrl) return 1
    return 0
  })

  return (
    <>
      {sortedPins.map((pin) => (
        <PinMarker key={pin.id} pin={pin} zoom={zoom} />
      ))}
    </>
  )
}

export default PinsList
