// components/pins/PinDetailPanel.tsx
import { useState, useEffect } from "react"
import { useSidebar } from "@/components/ui/sidebar"
import { 
  X, 
  CheckCircle2, 
  Circle, 
  MapPin, 
  Info, 
  Pencil, 
  Trash2, 
  CloudSun,
  Image as ImageIcon,
  Upload,
  Loader2,
  User,
  Map,
  Clock,
  Tag,
  FileText,
  Globe,
  Compass,
  Calendar
} from "lucide-react"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { getCategoryIcon } from "@/lib/categoryDisplay"
import { Button } from "@/components/ui/button"
import { useImageUpload } from "@/hooks/useImageUpload"

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
  // ✅ ALL HOOKS FIRST
  const { state } = useSidebar()
  const {
    secondaryPanel,
    setSecondaryPanel,
    setPrefillLocation,
    updatePin,
    deletePin,
    pins,
  } = usePins()
  const { categories } = useCategories()
  const { uploadImage, uploading: isUploadingImage, error: uploadError } = useImageUpload()

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
    }
  }, [isEditing, pin?.id])

  // ✅ EARLY RETURN AFTER ALL HOOKS
  if (!secondaryPanel || secondaryPanel.type === "settings") return null

  const title = isPinDetail ? pin!.customName || pin!.name : secondaryPanel.placeName
  const category = isPinDetail ? categories.find((c) => c.id === pin!.categoryId) : null

  function formatDate(date: string | null | undefined) {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  function formatTime(date: string | null | undefined) {
    if (!date) return "N/A"
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
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
        imageUrl: editImageUrl || null,
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

  return (
    <div
    className="fixed inset-y-0 z-40 w-96 overflow-y-auto border-l bg-background shadow-xl transition-[left] duration-200"
    style={{ 
      left: state === "expanded" ? "16rem" : "3rem",
      top: 0,
      height: "100vh"
    }}
  >
      {/* ✅ HEADER - Custom name big, Official name small */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            {isPinDetail ? (
              <>
                <h2 className="text-xl font-bold truncate">
                  {pin!.customName || pin!.name}
                </h2>
                {pin!.customName && (
                  <p className="mt-0.5 text-sm text-muted-foreground truncate">
                    {pin!.name}
                  </p>
                )}
              </>
            ) : (
              <h2 className="text-xl font-bold truncate">
                {secondaryPanel.placeName}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-4">
            {isPinDetail && !isEditing && !confirmingDelete && (
              <>
                <button
                  onClick={startEditing}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Edit pin"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete pin"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={() => setSecondaryPanel(null)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {isPinDetail && confirmingDelete && (
        <div className="mx-4 mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm text-destructive font-medium">Delete this pin? This can't be undone.</p>
          <div className="mt-3 flex gap-2">
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
        <div className="space-y-4 px-6 py-4">
          {/* Edit form fields... */}
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

          {/* Image Upload */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Image
            </label>
            <div className="space-y-2">
              {editImageUrl ? (
                <div className="relative rounded-md border overflow-hidden group">
                  <img
                    src={editImageUrl}
                    alt="Pin"
                    className="w-full h-32 object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 p-4 hover:border-muted-foreground/50 transition-colors">
                  <label className="flex cursor-pointer flex-col items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
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
              {imageUploadError && (
                <p className="text-sm text-destructive">{imageUploadError}</p>
              )}
              {uploadError && (
                <p className="text-sm text-destructive">{uploadError}</p>
              )}
            </div>
          </div>

          {editError && <p className="text-sm text-destructive">{editError}</p>}

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={cancelEditing} 
              disabled={saving || isImageUploading}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleSaveEdit} 
              disabled={saving || isImageUploading}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : isPinDetail ? (
        <div className="px-6 py-4 space-y-4">
          {/* ✅ IMAGE */}
          <div className="aspect-video w-full rounded-xl overflow-hidden bg-muted">
            {pin!.imageUrl ? (
              <img
                src={pin!.imageUrl}
                alt={title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageIcon className="h-12 w-12 opacity-20" />
                <span className="text-sm">No photo yet</span>
              </div>
            )}
          </div>

          {/* ✅ TAGS - Category and Visited aligned to the right */}
          <div className="flex items-center justify-end gap-2 -mt-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              {(() => {
                const CategoryIcon = getCategoryIcon(pin!.categoryId)
                return <CategoryIcon className="h-4 w-4" />
              })()}
              {category?.name ?? "Uncategorized"}
            </div>
            {pin!.visited && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#D97B29]/15 px-3 py-1.5 text-sm font-medium text-[#D97B29]">
                <CheckCircle2 className="h-4 w-4" />
                Visited
              </div>
            )}
          </div>

          {/* ✅ SECTION 1: YOUR INFORMATION */}
          <div className="rounded-xl border bg-card/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Your Information</h3>
            </div>
            
            <div className="space-y-3">
              {/* Custom Name */}
              {pin!.customName && (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Tag className="h-3 w-3" />
                    <span>Your Label</span>
                  </div>
                  <p className="text-sm font-medium text-foreground pl-5">
                    {pin!.customName}
                  </p>
                </div>
              )}

              {/* Custom Notes */}
              {pin!.customDescription && (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>Your Notes</span>
                  </div>
                  <p className="text-sm text-foreground pl-5 whitespace-pre-wrap leading-relaxed">
                    {pin!.customDescription}
                  </p>
                </div>
              )}

              {/* Visited Date */}
              {pin!.visited && pin!.visitDate && (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Visited On</span>
                  </div>
                  <p className="text-sm text-foreground pl-5">
                    {formatDate(pin!.visitDate)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ✅ SECTION 2: MAP INFORMATION */}
          <div className="rounded-xl border bg-card/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Map className="h-4 w-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Map Information</h3>
            </div>
            
            <div className="space-y-3">
              {/* Official Name */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  <span>Official Name</span>
                </div>
                <p className="text-sm font-medium text-foreground pl-5">
                  {pin!.name}
                </p>
              </div>

              {/* Address */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>Address</span>
                </div>
                <p className="text-sm text-foreground pl-5 leading-relaxed">
                  {pin!.description}
                </p>
              </div>

              {/* Coordinates */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Compass className="h-3 w-3" />
                  <span>Coordinates</span>
                </div>
                <p className="text-sm font-mono text-foreground pl-5">
                  {pin!.latitude.toFixed(6)}, {pin!.longitude.toFixed(6)}
                </p>
              </div>

              {/* Last Accessed */}
              {pin!.lastAccessedAt && (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Last Accessed</span>
                  </div>
                  <p className="text-sm text-foreground pl-5">
                    {formatDate(pin!.lastAccessedAt)} at {formatTime(pin!.lastAccessedAt)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ✅ SECTION 3: WEATHER */}
          <div className="rounded-xl border bg-card/50 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CloudSun className="h-4 w-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Weather</h3>
            </div>
            <div className="mt-2 pl-5">
              {weather ? (
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">
                    {Math.round(weather.temperatureC)}°
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {weather.description}
                  </span>
                </div>
              ) : weatherError ? (
                <p className="text-sm text-muted-foreground">{weatherError}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Loading weather…</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Preview mode (not pinned yet)
        <div className="px-6 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Not yet pinned
            </span>
          </div>
          <div className="rounded-xl border bg-card/50 p-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Address
            </h3>
            <p className="text-sm leading-relaxed text-foreground">
              {secondaryPanel.address}
            </p>
          </div>
          <Button onClick={handleAddToPins} className="w-full">
            Add to Pins
          </Button>
        </div>
      )}
    </div>
  )
}

export default PinDetailPanel
