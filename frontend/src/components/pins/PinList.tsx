// components/pins/PinList.tsx
import { useMemo } from "react"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import PinMarker from "@/components/pins/PinMarker"
import { useCommentCounts } from "@/hooks/useCommentCounts"

interface PinsListProps {
  zoom: number
}

// Viewport check — mirrors the helper previously defined in usePins. When a
// category filter is active, a pin only shows if it sits inside the current
// map bounds (existing behavior, kept unchanged).
function isInBounds(
  lat: number,
  lng: number,
  bounds: [number, number, number, number] | null
): boolean {
  if (!bounds) return true
  const [minLng, minLat, maxLng, maxLat] = bounds
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
}

const PinsList = ({ zoom }: PinsListProps) => {
  const { pins, activeCategoryIds, mapBounds, temporaryPois, pinVisibility } = usePins()
  const { categories } = useCategories()
  const commentCounts = useCommentCounts(pins)

  // Determine which pins to show based on visibility mode
  const showPinned = pinVisibility !== "unpinned"
  const showUnpinned = pinVisibility !== "pinned"

  // Category filter, scoped to the current viewport (existing behavior), plus
  // the extension: a pin also matches a selected category when that category's
  // name appears as a case-insensitive substring anywhere in the pin's name or
  // description — even if the pin isn't formally assigned that category.
  // Multi-select stays OR across categories. `tags` is not a field on the pin
  // model, so name/description are the two text fields this matches against.
  const visiblePins = useMemo(() => {
    if (activeCategoryIds.length === 0) return pins
    const activeCategoryNames = categories
      .filter((c) => activeCategoryIds.includes(c.id))
      .map((c) => c.name.toLowerCase())
    return pins.filter((pin) => {
      if (!isInBounds(pin.latitude, pin.longitude, mapBounds)) return false
      if (activeCategoryIds.includes(pin.categoryId)) return true
      const haystack = `${pin.name} ${pin.description ?? ""}`.toLowerCase()
      return activeCategoryNames.some((name) => name.length > 0 && haystack.includes(name))
    })
  }, [pins, activeCategoryIds, mapBounds, categories])

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
          <PinMarker
            key={pin.id}
            pin={pin}
            zoom={zoom}
            commentCount={commentCounts[pin.id]}
          />
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
          />
        ))}
    </>
  )
}

export default PinsList
