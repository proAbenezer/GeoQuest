import { useState } from "react"
import { useSidebar } from "@/components/ui/sidebar"
import { X, CheckCircle2, Circle, MapPin, Info, Pencil, Trash2 } from "lucide-react"
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
    updatePin,
    deletePin,
  } = usePins()
  const { categories } = useCategories()

  const [isEditing, setIsEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Edit form state
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editCategoryId, setEditCategoryId] = useState("")

  if (!secondaryPanel || secondaryPanel.type === "settings") return null

  const isPinDetail = secondaryPanel.type === "pinDetail"
  const pin = isPinDetail ? secondaryPanel.pin : null

  const title = isPinDetail ? pin!.customName || pin!.name : secondaryPanel.placeName
  const category = isPinDetail ? categories.find((c) => c.id === pin!.categoryId) : null

  function handleAddToPins() {
    if (secondaryPanel?.type !== "preview") return
    setPrefillLocation({
      placeName: secondaryPanel.placeName,
      address: secondaryPanel.address,
      latitude: secondaryPanel.lat,
      longitude: secondaryPanel.lng,
    })
    setSecondaryPanel({ type: "addPin" })
  }

  function startEditing() {
    if (!pin) return
    setEditName(pin.customName ?? "")
    setEditDescription(pin.customDescription ?? "")
    setEditCategoryId(pin.categoryId)
    setEditError(null)
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setEditError(null)
  }

  async function handleSaveEdit() {
    if (!pin) return
    setSaving(true)
    setEditError(null)
    try {
      const updated = await updatePin(pin.id, {
        customName: editName.trim() || null,
        customDescription: editDescription.trim() || null,
        categoryId: editCategoryId,
      })
      setSecondaryPanel({ type: "pinDetail", pin: updated })
      setIsEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update pin")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleVisited() {
    if (!pin) return
    try {
      const updated = await updatePin(pin.id, { visited: !pin.visited })
      setSecondaryPanel({ type: "pinDetail", pin: updated })
    } catch {
      // silently ignore — non-critical toggle, badge just won't change
    }
  }

  async function handleDelete() {
    if (!pin) return
    setDeleting(true)
    try {
      await deletePin(pin.id)
      setSecondaryPanel(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to delete pin")
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-y-0 z-40 w-80 overflow-y-auto border-r bg-background shadow-xl transition-[left] duration-200"
      style={{ left: state === "expanded" ? "16rem" : "3rem" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-heading text-lg leading-tight font-semibold truncate">
            {title}
          </h2>
          {isPinDetail && pin!.customName && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {pin!.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isPinDetail && !isEditing && !confirmingDelete && (
            <>
              <button
                onClick={startEditing}
                className="text-muted-foreground transition-colors hover:text-foreground p-1"
                aria-label="Edit pin"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-muted-foreground transition-colors hover:text-destructive p-1"
                aria-label="Delete pin"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={() => setSecondaryPanel(null)}
            className="text-muted-foreground transition-colors hover:text-foreground p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {isPinDetail && confirmingDelete && (
        <div className="flex flex-col gap-3 border-b bg-destructive/10 px-5 py-4">
          <p className="text-sm text-destructive">
            Delete this pin? This can't be undone.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      )}

      {isPinDetail && isEditing ? (
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Custom Name
            </label>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={pin!.name}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Category
            </label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={editCategoryId}
              onChange={(e) => setEditCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Your Notes
            </label>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </div>
          {editError && <p className="text-sm text-destructive">{editError}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={cancelEditing} disabled={saving}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : isPinDetail ? (
        <>
          <div className="aspect-video w-full bg-muted">
            {pin!.imageUrl ? (
              <img
                src={pin!.imageUrl}
                alt={title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                No photo yet
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 px-5 py-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {(() => {
                const CategoryIcon = getCategoryIcon(pin!.categoryId)
                return <CategoryIcon className="h-3.5 w-3.5" />
              })()}
              {category?.name ?? pin!.categoryId}
            </span>
            <button
              onClick={handleToggleVisited}
              className={
                pin!.visited
                  ? "inline-flex items-center gap-1.5 rounded-full bg-[#D97B29]/15 px-3 py-1 text-xs font-medium text-[#D97B29]"
                  : "inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
              }
            >
              {pin!.visited ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              {pin!.visited ? "Visited" : "Not visited"}
            </button>
          </div>

          {category?.description && (
            <div className="flex items-start gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{category.description}</span>
            </div>
          )}

          <div className="border-t px-5 py-4">
            <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Address
            </h3>
            <p className="text-sm leading-relaxed text-foreground">
              {pin!.description}
            </p>
          </div>

          {pin!.customDescription && (
            <div className="border-t px-5 py-4">
              <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Your Notes
              </h3>
              <p className="text-sm leading-relaxed text-foreground">
                {pin!.customDescription}
              </p>
            </div>
          )}
        </>
      ) : (
        <>
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
