// components/pins/PinList.tsx
import { usePins } from "@/context/usePins"
import PinMarker from "@/components/pins/PinMarker"

interface PinsListProps {
  zoom: number
}

const PinsList = ({ zoom }: PinsListProps) => {
  const {
    pins,
    filteredPins,
    temporaryPois,
    activeCategoryIds,
    pinVisibility,
  } = usePins()

  // Determine which pins to show based on visibility mode
  const showPinned = pinVisibility !== "unpinned"
  const showUnpinned = pinVisibility !== "pinned"

  // Saved pins: use filteredPins if any filter active, else all pins
  const visiblePins = activeCategoryIds.length > 0 ? filteredPins : pins
  const sortedPins = [...visiblePins].sort((a, b) => {
    if (a.visited && !b.visited) return -1
    if (!a.visited && b.visited) return 1
    if (a.imageUrl && !b.imageUrl) return -1
    if (!a.imageUrl && b.imageUrl) return 1
    return 0
  })

  return (
    <>
      {/* Pinned (saved) markers */}
      {showPinned &&
        sortedPins.map((pin) => (
          <PinMarker key={pin.id} pin={pin} zoom={zoom} />
        ))}

      {/* Unpinned (temporary) markers – only when at least one filter is active */}
{showUnpinned &&
  activeCategoryIds.length > 0 &&
  temporaryPois.map((poi) => (
    <PinMarker
      key={poi.id}
      pin={{
        id: poi.id,
        name: poi.placeName,
        description: poi.address,
        visited: false,
        latitude: poi.lat,
        longitude: poi.lng,
        categoryId: poi.categoryId,
        placeId: poi.id,
        countryCode: poi.countryCode,
      }}
      zoom={zoom}
      isTemporary={true}
      categoryName={poi.categoryName}
    />
  ))}   </>
  )
}

export default PinsList
