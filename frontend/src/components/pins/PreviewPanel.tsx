// components/pins/PreviewPanel.tsx
import { useMemo } from "react"
import { usePins } from "@/context/usePins"
import { usePanelManager } from "@/hooks/usePanelManager"
import { usePlaceLookup } from "@/hooks/usePlaceLookup"
import { X, MapPin, Plus } from "lucide-react"
import SidePanel from "@/components/layout/sidebar/SidePanel"
import CommentSection from "@/components/comments/CommentSection"

const PreviewPanel = () => {
  const { secondaryPanel, setSecondaryPanel } = usePins()
  const { openAddPin, closeAllPanels } = usePanelManager()
  const { findPlaceAt } = usePlaceLookup()

  // All hooks must run on every render — never after an early return. So pull
  // the coords out up here (undefined when the panel is closed) and only run
  // the place lookup when a preview is actually open.
  const previewLat = secondaryPanel?.type === "preview" ? secondaryPanel.lat : undefined
  const previewLng = secondaryPanel?.type === "preview" ? secondaryPanel.lng : undefined
  const placeCheck = useMemo(
    () =>
      previewLat !== undefined && previewLng !== undefined
        ? findPlaceAt(previewLat, previewLng)
        : null,
    [previewLat, previewLng, findPlaceAt]
  )
  const showComments = Boolean(placeCheck?.isUnlocked && placeCheck.placeId)

  if (secondaryPanel?.type !== "preview") return null

  const { placeName, address, lat, lng } = secondaryPanel

  const commentTarget =
    showComments && placeCheck
      ? {
          type: "location" as const,
          placeId: placeCheck.placeId ?? undefined,
          latitude: lat,
          longitude: lng,
        }
      : null

  const handleAddPin = () => {
    openAddPin({
      placeName,
      address,
      latitude: lat,
      longitude: lng,
    })
  }

  return (
    <SidePanel
      widthClassName="w-96"
      onOpenChange={(open) => {
        if (!open) setSecondaryPanel(null)
      }}
    >
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
            <MapPin className="h-4 w-4" />
          </div>
          <h3 className="font-semibold">Location Details</h3>
        </div>
        <button
          onClick={closeAllPanels}
          className="rounded-lg p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
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

        {commentTarget && <CommentSection target={commentTarget} />}
      </div>
    </SidePanel>
  )
}

export default PreviewPanel
