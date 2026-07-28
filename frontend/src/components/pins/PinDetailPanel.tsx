import { useSidebar } from "@/components/ui/sidebar"
import { X, CheckCircle2, Circle, MapPin } from "lucide-react"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { getCategoryIcon } from "@/lib/categoryDisplay"
import { Button } from "@/components/ui/button"

const PinDetailPanel = () => {
  const { state } = useSidebar()
  const {
    secondaryPanel,
    setSecondaryPanel,
    setPrefillLocation,
    setIsAddingPin,
  } = usePins()
  const { categories } = useCategories()

  if (!secondaryPanel || secondaryPanel.type === "settings") return null

  const title =
    secondaryPanel.type === "pinDetail"
      ? secondaryPanel.pin.name
      : secondaryPanel.placeName

  function handleAddToPins() {
    if (secondaryPanel?.type !== "preview") return
    setPrefillLocation({
      placeName: secondaryPanel.placeName,
      address: secondaryPanel.address,
      latitude: secondaryPanel.lat,
      longitude: secondaryPanel.lng,
    })
    setSecondaryPanel(null)
    setIsAddingPin(true)
  }

  return (
    <div
      className="fixed inset-y-0 z-40 w-80 overflow-y-auto border-r bg-background shadow-xl transition-[left] duration-200"
      style={{ left: state === "expanded" ? "16rem" : "3rem" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b px-5 py-4">
        <h2 className="font-heading text-lg leading-tight font-semibold">
          {title}
        </h2>
        <button
          onClick={() => setSecondaryPanel(null)}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {secondaryPanel.type === "pinDetail" ? (
        <>
          {/* Image */}
          <div className="aspect-video w-full bg-muted">
            {secondaryPanel.pin.imageUrl ? (
              <img
                src={secondaryPanel.pin.imageUrl}
                alt={secondaryPanel.pin.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                No photo yet
              </div>
            )}
          </div>
          {/* Meta badges */}
          <div className="flex flex-wrap gap-2 px-5 py-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {(() => {
                const CategoryIcon = getCategoryIcon(
                  secondaryPanel.pin.categoryId
                )
                return <CategoryIcon className="h-3.5 w-3.5" />
              })()}
              {categories.find((c) => c.id === secondaryPanel.pin.categoryId)
                ?.name ?? secondaryPanel.pin.categoryId}
            </span>
            <span
              className={
                secondaryPanel.pin.visited
                  ? "inline-flex items-center gap-1.5 rounded-full bg-[#D97B29]/15 px-3 py-1 text-xs font-medium text-[#D97B29]"
                  : "inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
              }
            >
              {secondaryPanel.pin.visited ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              {secondaryPanel.pin.visited ? "Visited" : "Not visited"}
            </span>
          </div>
          {/* Description */}
          <div className="border-t px-5 py-4">
            <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              About
            </h3>
            <p className="text-sm leading-relaxed text-foreground">
              {secondaryPanel.pin.description ?? "No description added yet."}
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Preview mode: unvisited, unpinned location */}
          <div className="flex flex-wrap gap-2 px-5 py-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Not yet pinned
            </span>
          </div>
          <div className="border-t px-5 py-4">
            <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Address
            </h3>
            <p className="text-sm leading-relaxed text-foreground">
              {secondaryPanel.address}
            </p>
          </div>
          <div className="px-5 pb-5">
            <Button onClick={handleAddToPins} className="w-full">
              Add to Pins
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export default PinDetailPanel
