// components/pins/PinDetailPanel.tsx
import { useState, useEffect } from "react"
import {
  X,
  CheckCircle2,
  CircleDashed,
  MapPin,
  Pencil,
  Trash2,
  CloudSun,
  Image as ImageIcon,
  Upload,
  Loader2,
  User,
  Map,
  Tag,
  FileText,
  Globe,
  Compass,
  Calendar
} from "lucide-react"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { getCategoryIcon, getIconList } from "@/lib/categoryDisplay"
import { Button } from "@/components/ui/button"
import { IconStack } from "@/components/ui/icon-stack"
import { IconMultiSelect } from "@/components/ui/icon-multi-select"
import { useImageUpload } from "@/hooks/useImageUpload"
import { VISITED_RADIUS_M } from "@/hooks/useVisitedCheckin"
import SidePanel from "@/components/layout/sidebar/SidePanel"
import CommentSection from "@/components/comments/CommentSection"

// Open-Meteo WMO weather codes
function describeWeatherCode(code: number): string {
  if (code === 0) return "Clear sky"
  if ([1, 2, 3].includes(code)) return "Partly cloudy"
  if ([45, 48].includes(code)) return "Foggy"
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle"
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain"
  if ([71, 73, 75, 77].includes(code)) return "Snow"
  if ([80, 81, 82].includes(code)) return "Rain showers"
  if ([85, 86].includes(code)) return "Snow showers"
  if ([95, 96, 99].includes(code)) return "Thunderstorm"
  return "Unknown"
}

interface WeatherData {
  temperatureC: number
  description: string
}

const PinDetailPanel = () => {
  const {
    secondaryPanel,
    setSecondaryPanel,
    setPrefillLocation,
    updatePin,
    deletePin,
    pins,
  } = usePins()
  const { categories } = useCategories()
  const { uploadImage, error: uploadError } = useImageUpload()

  // State for edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Edit form fields
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editCategoryId, setEditCategoryId] = useState("")
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null)
  const [editIcons, setEditIcons] = useState<string[]>([])

  // Image upload state
  const [isImageUploading, setIsImageUploading] = useState(false)
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)

  // Weather state
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherError, setWeatherError] = useState<string | null>(null)

  // Derive values
  const isPinDetail = secondaryPanel?.type === "pinDetail"
  const panelPin = isPinDetail ? secondaryPanel!.pin : null
  const pin = panelPin ? pins.find(p => p.id === panelPin.id) || panelPin : null

  // Update the panel's pin data when it changes in the context
  useEffect(() => {
    if (panelPin && pin && pin !== panelPin) {
      setSecondaryPanel({ type: "pinDetail", pin })
    }
  }, [pin, panelPin, setSecondaryPanel])

  // Reset transient UI state whenever the open pin changes (or the panel
  // closes). Without this, confirming a delete (or entering edit mode) on one
  // pin leaks onto the next pin opened — e.g. pin A's "Delete this pin?"
  // confirmation incorrectly appears on pin B.
  useEffect(() => {
    setConfirmingDelete(false)
    setIsEditing(false)
    setSaving(false)
    setDeleting(false)
    setEditError(null)
  }, [pin?.id])

  // Fetch weather
  useEffect(() => {
    if (!pin) {
      setWeather(null)
      setWeatherError(null)
      return
    }
    let cancelled = false
    setWeather(null)
    setWeatherError(null)
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${pin.latitude}&longitude=${pin.longitude}&current=temperature_2m,weather_code`
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data?.current) {
          setWeather({
            temperatureC: data.current.temperature_2m,
            description: describeWeatherCode(data.current.weather_code),
          })
        } else {
          setWeatherError("Weather unavailable")
        }
      })
      .catch(() => {
        if (!cancelled) setWeatherError("Weather unavailable")
      })
    return () => {
      cancelled = true
    }
  }, [pin?.id])

  // Update form when editing
  useEffect(() => {
    if (isEditing && pin) {
      setEditName(pin.customName ?? "")
      setEditDescription(pin.customDescription ?? "")
      setEditCategoryId(pin.categoryId)
      setEditImageUrl(pin.imageUrl ?? null)
      setEditIcons(pin.icons ?? [])
    }
  }, [isEditing, pin?.id])

  // Early return – panel only renders when active
  if (secondaryPanel?.type !== "pinDetail") return null

  const title = pin!.customName || pin!.name
  const category = isPinDetail ? categories.find((c) => c.id === pin!.categoryId) : null

  function formatDate(date: string | null | undefined) {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

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
    setEditImageUrl(pin.imageUrl ?? null)
    setEditIcons(pin.icons ?? [])
    setEditError(null)
    setImageUploadError(null)
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setEditError(null)
    setImageUploadError(null)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setImageUploadError("Image must be less than 5MB")
      return
    }

    if (!file.type.startsWith("image/")) {
      setImageUploadError("Please select an image file")
      return
    }

    setIsImageUploading(true)
    setImageUploadError(null)

    try {
      const url = await uploadImage(file)
      if (url) {
        setEditImageUrl(url)
        setImageUploadError(null)
      } else {
        setImageUploadError("Failed to upload image. Please try again.")
      }
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : "Failed to upload image")
    } finally {
      setIsImageUploading(false)
    }
  }

  function handleRemoveImage() {
    setEditImageUrl(null)
    setImageUploadError(null)
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
        imageUrl: editImageUrl ?? undefined,
        icons: editIcons,
      })
      setSecondaryPanel({ type: "pinDetail", pin: updated })
      setIsEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update pin")
    } finally {
      setSaving(false)
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

  // ─── Use the shared SidePanel ──────────────────────────────
  return (
    <SidePanel
      widthClassName="w-96"
      onOpenChange={(open) => {
        if (!open) setSecondaryPanel(null)
      }}
    >
      {/* HEADER – includes the X close button */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            {isPinDetail ? (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold truncate leading-tight">
                    {pin!.customName || pin!.name}
                  </h2>
                  {pin!.customName && (
                    <p className="text-sm text-muted-foreground truncate">{pin!.name}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-semibold truncate leading-tight">
                  {pin!.name}
                </h2>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-4">
            {isPinDetail && !isEditing && !confirmingDelete && (
              <>
                <button
                  onClick={startEditing}
                  className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Edit pin"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete pin"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
            {/* ✅ X button – closes the panel */}
            <button
              onClick={() => setSecondaryPanel(null)}
              className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {isPinDetail && confirmingDelete && (
        <div className="mx-3 mt-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm text-destructive font-medium">Delete this pin? This can't be undone.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      )}

      {isPinDetail && isEditing ? (
        <div className="space-y-3 px-3 py-4">
          <div className="rounded-xl border bg-card/50 p-3 space-y-3">
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
                  <option key={c.id} value={c.id}>{c.name}</option>
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

            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Icons
              </label>
              <IconMultiSelect value={editIcons} onChange={setEditIcons} />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Image
              </label>
              <div className="space-y-2">
                {editImageUrl ? (
                  <div className="relative rounded-md border overflow-hidden group">
                    <img src={editImageUrl} alt="Pin" className="w-full h-32 object-cover" />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 p-4 hover:border-muted-foreground/50">
                    <label className="flex cursor-pointer flex-col items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                      <Upload className="h-6 w-6" />
                      <span>Click to upload image</span>
                      <span className="text-xs">PNG, JPG, GIF up to 5MB</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isImageUploading}
                      />
                    </label>
                  </div>
                )}
                {isImageUploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading image...
                  </div>
                )}
                {imageUploadError && <p className="text-sm text-destructive">{imageUploadError}</p>}
                {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
              </div>
            </div>
          </div>

          {editError && <p className="text-sm text-destructive">{editError}</p>}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={cancelEditing} disabled={saving || isImageUploading}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSaveEdit} disabled={saving || isImageUploading}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : isPinDetail ? (
        <div className="px-3 py-4 space-y-3">
          {/* Image */}
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-muted">
            {pin!.imageUrl ? (
              <img src={pin!.imageUrl} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageIcon className="h-12 w-12 opacity-20" />
                <span className="text-sm">No photo yet</span>
              </div>
            )}
          </div>

          {/* Tags – icon cluster + category pill + visited tag */}
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {pin!.icons && pin!.icons.length > 0 && (
              <IconStack
                icons={getIconList(pin!.icons, getCategoryIcon(pin!.categoryId))}
                size="h-4 w-4"
                max={3}
                className="text-primary"
              />
            )}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <IconStack
                icons={
                  category
                    ? getIconList(category.icons, getCategoryIcon(category.id))
                    : [getCategoryIcon(pin!.categoryId)]
                }
                size="h-3.5 w-3.5"
                max={2}
              />
              {category?.name ?? "Uncategorized"}
            </div>
            {/* Visited tag – GPS check-in driven. Always shown so the user can
                tell whether they've physically been near this pin yet. */}
            {pin!.visited ? (
              <div
                className="inline-flex items-center gap-1.5 rounded-full bg-[#D97B29]/15 px-3 py-1.5 text-sm font-medium text-[#D97B29]"
                title="You've been near this pin (GPS check-in)"
              >
                <CheckCircle2 className="h-4 w-4" />
                Visited
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground"
                title={`Not yet — visit within ${VISITED_RADIUS_M}m and it will mark itself`}
              >
                <CircleDashed className="h-4 w-4" />
                Not visited yet
              </div>
            )}
          </div>

          {/* Your Information */}
          <div className="rounded-xl border bg-card/50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Your Information</h3>
            </div>
            <div className="space-y-3">
              {pin!.customName && (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Tag className="h-3 w-3" />
                    <span>Your Label</span>
                  </div>
                  <p className="text-sm font-medium text-foreground pl-5">{pin!.customName}</p>
                </div>
              )}
              {pin!.customDescription && (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>Your Notes</span>
                  </div>
                  <p className="text-sm text-foreground pl-5 whitespace-pre-wrap leading-relaxed">{pin!.customDescription}</p>
                </div>
              )}
              {pin!.visited && pin!.visitDate && (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Visited On</span>
                  </div>
                  <p className="text-sm text-foreground pl-5">{formatDate(pin!.visitDate)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Map Information */}
          <div className="rounded-xl border bg-card/50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Map className="h-3.5 w-3.5" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Map Information</h3>
            </div>
            <div className="space-y-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  <span>Official Name</span>
                </div>
                <p className="text-sm font-medium text-foreground pl-5">{pin!.name}</p>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>Address</span>
                </div>
                <p className="text-sm text-foreground pl-5 leading-relaxed">{pin!.description}</p>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Compass className="h-3 w-3" />
                  <span>Coordinates</span>
                </div>
                <p className="text-sm font-mono text-foreground pl-5 break-all">
                  {pin!.latitude.toFixed(4)}, {pin!.longitude.toFixed(4)}
                </p>
              </div>
            </div>
          </div>

          {/* Weather */}
          <div className="rounded-xl border bg-card/50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CloudSun className="h-3.5 w-3.5" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Weather</h3>
            </div>
            <div className="pl-5">
              {weather ? (
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{Math.round(weather.temperatureC)}°</span>
                  <span className="text-sm text-muted-foreground">{weather.description}</span>
                </div>
              ) : weatherError ? (
                <p className="text-sm text-muted-foreground">{weatherError}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Loading weather…</p>
              )}
            </div>
          </div>

          {/* Community comments */}
          <CommentSection
            target={{
              type: "pin",
              pinId: pin!.id,
              latitude: pin!.latitude,
              longitude: pin!.longitude,
            }}
          />
        </div>
      ) : (
        // Preview mode (not pinned yet)
        <div className="px-3 py-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Not yet pinned
            </span>
          </div>
          <div className="rounded-xl border bg-card/50 p-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</h3>
            <p className="text-sm leading-relaxed text-foreground">{pin!.description}</p>
          </div>
          <Button onClick={handleAddToPins} className="w-full">Add to Pins</Button>
        </div>
      )}
    </SidePanel>
  )
}

export default PinDetailPanel
