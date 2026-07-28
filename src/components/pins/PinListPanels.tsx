import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { getCategoryIcon } from "@/lib/categoryDisplay"
import { CheckCircle2, Circle } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"

const PinListPanels = () => {
  const {
    pins,
    listPanel,
    setSecondaryPanel,
    setFlyToTarget,
    setHighlightedPinId,
  } = usePins()
  const { categories } = useCategories()

  if (
    !listPanel ||
    (listPanel.type !== "categoryList" &&
      listPanel.type !== "saved" &&
      listPanel.type !== "recentlyVisited")
  ) {
    return null
  }

  let title = ""
  let filteredPins = pins
  let emptyMessage = "No pins here yet."

  if (listPanel.type === "categoryList") {
    const category = categories.find((c) => c.id === listPanel.categoryId)
    title = category?.name ?? "Category"
    filteredPins = pins.filter((p) => p.categoryId === listPanel.categoryId)
    emptyMessage = "No places in this category yet."
  } else if (listPanel.type === "saved") {
    title = "Saved Places"
    filteredPins = pins.filter((p) => p.saved)
    emptyMessage = "No saved places yet."
  } else if (listPanel.type === "recentlyVisited") {
    title = "Recently Visited"
    filteredPins = pins
      .filter((p) => p.visited)
      .sort((a, b) => {
        const dateA = a.visitDate ? new Date(a.visitDate).getTime() : 0
        const dateB = b.visitDate ? new Date(b.visitDate).getTime() : 0
        return dateB - dateA
      })
    emptyMessage = "No visited places yet."
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarGroupContent
        className="max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/15 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent"
        style={{ scrollbarWidth: "thin" }}
      >
        {filteredPins.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filteredPins.map((pin) => {
              const CategoryIcon = getCategoryIcon(pin.categoryId)
              return (
                <li key={pin.id}>
                  <button
                    onClick={() => {
                      setSecondaryPanel({ type: "pinDetail", pin })
                      setFlyToTarget({
                        latitude: pin.latitude,
                        longitude: pin.longitude,
                      })
                      setHighlightedPinId(pin.id)
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted"
                  >
                    <CategoryIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {pin.name}
                    </span>
                    {pin.visited ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#D97B29]" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export default PinListPanels
