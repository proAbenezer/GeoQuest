// components/pins/PreviewPanel.tsx
import { usePins } from "@/context/usePins"
import { usePanelManager } from "@/hooks/usePanelManager"
import { useSidebar } from "@/components/ui/sidebar"
import { X, MapPin, Plus } from "lucide-react"

const PreviewPanel = () => {
  const { secondaryPanel } = usePins()
  const { openAddPin, closeAllPanels } = usePanelManager()
  const { state } = useSidebar()

  if (secondaryPanel?.type !== "preview") return null

  const { placeName, address, lat, lng } = secondaryPanel

  const handleAddPin = () => {
    openAddPin({
      placeName,
      address,
      latitude: lat,
      longitude: lng,
    })
  }

  const sidebarWidth = state === "expanded" ? "var(--sidebar-width)" : "var(--sidebar-width-icon)"

  return (
    <div
      className="fixed inset-y-0 z-50 w-80 overflow-y-auto bg-background shadow-2xl transition-[left] duration-200"
      style={{ left: sidebarWidth }}
    >
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-[#D97B29]" />
          <h3 className="font-semibold">Location Details</h3>
        </div>
        <button
          onClick={closeAllPanels}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <h4 className="font-medium">{placeName}</h4>
          <p className="text-sm text-muted-foreground">{address}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>
        </div>
        <button
          onClick={handleAddPin}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Pin at this location
        </button>
        <button
          onClick={closeAllPanels}
          className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default PreviewPanel
