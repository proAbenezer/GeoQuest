// components/pins/PinListPanels.tsx
import { MapPin, Star, Clock, FolderOpen } from "lucide-react"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { getCategoryIcon } from "@/lib/categoryDisplay"

const PinListPanels = () => {
  const { listPanel, pins, setSelectedPin } = usePins()
  const { categories } = useCategories()

  if (!listPanel) return null

  // Icon used on each pin row, matching the active panel type
  const getPinIcon = () => {
    switch (listPanel.type) {
      case "saved":
        return Star
      case "recentlyVisited":
        return Clock
      case "categoryList": {
        const category = categories.find(c => c.id === listPanel.categoryId)
        return category ? getCategoryIcon(category.id) : FolderOpen
      }
      default:
        return MapPin
    }
  }

  // Pins to display based on the active panel type
  const getPins = () => {
    switch (listPanel.type) {
      case "saved":
        return pins.filter(p => p.saved)
      case "recentlyVisited":
        return pins.filter(p => p.recentlyVisited)
      case "categoryList":
        return pins.filter(p => p.categoryId === listPanel.categoryId)
      default:
        return []
    }
  }

  const PinIcon = getPinIcon()
  const displayedPins = getPins()

  if (displayedPins.length === 0) {
    return (
      <div className="text-sm text-muted-foreground px-3 py-4 text-center group-data-[collapsible=icon]:hidden">
        No pins found
      </div>
    )
  }

  return (
    <div className="space-y-0.5 group-data-[collapsible=icon]:w-full">
      {displayedPins.map((pin) => (
        <button
          key={pin.id}
          onClick={() => setSelectedPin(pin)}
          className="
            flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
            text-foreground hover:bg-muted/50
            group-data-[collapsible=icon]:justify-center
            group-data-[collapsible=icon]:px-2
            group-data-[collapsible=icon]:py-2.5
          "
        >
          <PinIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left truncate group-data-[collapsible=icon]:hidden">
            {pin.name}
          </span>
        </button>
      ))}
    </div>
  )
}

export default PinListPanels
