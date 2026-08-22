// components/pins/PinList.tsx
import { usePins } from "@/context/usePins"
import PinMarker from "@/components/pins/PinMarker"

interface PinsListProps {
  zoom: number
}

const PinsList = ({ zoom }: PinsListProps) => {
  const { pins, filteredPins, temporaryPois, activeCategoryIds } = usePins()

  // Decide which pins to show: if any filter is active, use filteredPins, else all pins
  const visiblePins = activeCategoryIds.length > 0 ? filteredPins : pins

  // Sort: visited first, then images
  const sortedPins = [...visiblePins].sort((a, b) => {
    if (a.visited && !b.visited) return -1
    if (!a.visited && b.visited) return 1
    if (a.imageUrl && !b.imageUrl) return -1
    if (!a.imageUrl && b.imageUrl) return 1
    return 0
  })

  return (
    <>
      {/* Saved pins */}
      {sortedPins.map((pin) => (
        <PinMarker key={pin.id} pin={pin} zoom={zoom} />
      ))}

      {/* Temporary POIs (not yet saved) – render with a distinct style */}
      {temporaryPois.map((poi) => (
        <PinMarker
          key={poi.id}
          pin={{
            id: poi.id,
            placeName: poi.placeName,
            address: poi.address,
            latitude: poi.lat,
            longitude: poi.lng,
            categoryId: '', // we don't have categoryId, but we have categoryName
            // we can store categoryName in an extra field if needed, but we'll use a flag
            // to mark it as temporary. For now we pass a flag via a custom prop.
            // We'll modify PinMarker to accept an optional isTemporary prop.
            // Alternatively, we can use a different marker component.
            // We'll extend PinMarker to accept isTemporary.
          }}
          zoom={zoom}
          isTemporary={true}
          categoryName={poi.categoryName}
        />
      ))}
    </>
  )
}

export default PinsList
