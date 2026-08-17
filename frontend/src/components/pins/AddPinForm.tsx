import { useState, useEffect, useMemo } from "react"
import { useSidebar } from "@/components/ui/sidebar"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { Button } from "@/components/ui/button"
import { X, Lock, Tag, ImageOff } from "lucide-react"
import { useLocationSearch } from "@/hooks/useLocationSearch"
import { usePlaceLookup } from "@/hooks/usePlaceLookup"
import LocationSearchField from "./LocationSearchField"
import LocationPreview from "@/components/pins/LocationPreview"
import PinFormFields from "@/components/pins/PinFormFields"
import CategoryForm from "@/components/layout/category/CategoryForm"

const AddPinPanel = () => {
  const { state } = useSidebar()
  const {
    addPin,
    secondaryPanel,
    setSecondaryPanel,
    prefillLocation,
    setPrefillLocation,
  } = usePins()
  const { categories, loading: categoriesLoading, addCategory } = useCategories()

  // User's own custom label — separate from the place's own name/address,
  // which comes from the map/reverse-geocode and is shown via LocationPreview.
  const [pinName, setPinName] = useState("")
  const [pinDescription, setPinDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [imageUrl, setImageUrl] = useState("")

  // TODO: Cloudinary is currently down (invalid API key in .env).
  // Upload failures are surfaced here instead of blocking pin creation —
  // imageUrl stays optional, so users can finish the pin now and add a
  // photo later once the upload service is back.
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Stops auto-filling pinName from the place once the user starts typing their own.
  const [nameTouched, setNameTouched] = useState(false)

  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)

  const search = useLocationSearch(prefillLocation)
  const { findPlaceAt } = usePlaceLookup()
  const isOpen = secondaryPanel?.type === "addPin"

  const [cameFromMapClick, setCameFromMapClick] = useState(() =>
    Boolean(prefillLocation)
  )

  useEffect(() => {
    if (isOpen) {
      setCameFromMapClick(Boolean(prefillLocation))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (!prefillLocation) return
    if (!nameTouched) setPinName(prefillLocation.placeName)
    setPrefillLocation(null)
  }, [prefillLocation, setPrefillLocation, nameTouched])

  const placeCheck = useMemo(() => {
    if (!search.location) return null
    return findPlaceAt(search.location.latitude, search.location.longitude)
  }, [search.location, findPlaceAt])

  const isBlocked = Boolean(search.location) && !placeCheck?.isUnlocked
  const hasNoCategories = !categoriesLoading && categories.length === 0

  if (!isOpen) return null

  function resetForm() {
    setPinName("")
    setPinDescription("")
    setCategoryId("")
    setImageUrl("")
    setUploadError(null)
    setNameTouched(false)
    search.reset()
    setSecondaryPanel(null)
  }

  function handlePinNameChange(value: string) {
    setNameTouched(true)
    setPinName(value)
  }

  async function handleCreateFirstCategory() {
    if (!newCategoryName.trim()) return setCategoryError("Category name is required")
    setCreatingCategory(true)
    setCategoryError(null)
    try {
      const category = await addCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || "No description",
      })
      setCategoryId(category.id)
      setNewCategoryName("")
      setNewCategoryDescription("")
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "Failed to create category")
    } finally {
      setCreatingCategory(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!search.location)
      return alert("Please search and select a location first")
    if (!categoryId) return alert("Please select a category")
    if (!placeCheck?.isUnlocked || !placeCheck.placeId) {
      return alert("You can only add pins inside places you've unlocked")
    }
    try {
      await addPin({
        // Required, official place info — never blank, comes from the map.
        name: search.location.placeName,
        description: search.location.address,
        // Optional — user's own label/notes, only sent if they actually typed something.
        customName: pinName.trim() || null,
        customDescription: pinDescription.trim() || null,
        visitDate: null,
        visited: false,
        latitude: search.location.latitude,
        longitude: search.location.longitude,
        categoryId,
        placeId: placeCheck.placeId,
        // Stays optional — a failed/skipped upload never blocks pin creation.
        imageUrl: imageUrl.trim() || undefined,
      })
      resetForm()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create pin")
    }
  }

  return (
    <div
      className="fixed inset-y-0 z-40 w-80 overflow-y-auto border-r bg-background shadow-xl transition-[left] duration-200"
      style={{ left: state === "expanded" ? "16rem" : "3rem" }}
    >
      <div className="flex items-start justify-between border-b px-5 py-4">
        <h2 className="text-lg font-semibold">Add New Pin</h2>
        <button
          onClick={resetForm}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {hasNoCategories ? (
        <>
          <div className="flex items-start gap-2 px-5 pt-4 text-sm text-primary">
            <Tag className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              You don't have any categories yet. Create one before adding your first pin.
            </span>
          </div>
          <CategoryForm
            name={newCategoryName}
            setName={setNewCategoryName}
            description={newCategoryDescription}
            setDescription={setNewCategoryDescription}
            onSubmit={handleCreateFirstCategory}
          />
          {categoryError && (
            <p className="px-5 text-sm text-destructive">{categoryError}</p>
          )}
        </>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {!cameFromMapClick && (
            <LocationSearchField
              containerRef={search.containerRef}
              searchQuery={search.searchQuery}
              suggestions={search.suggestions}
              showSuggestions={search.showSuggestions}
              onInputChange={search.onInputChange}
              onInputKeyDown={search.onInputKeyDown}
              onSelect={search.selectSuggestion}
              onFocus={() =>
                search.suggestions.length > 0 && search.setShowSuggestions(true)
              }
            />
          )}

          {/* What the map found at this spot — read-only, never edited here. */}
          <LocationPreview location={search.location} />

          {isBlocked && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                This location is inside a place you haven't unlocked yet.
                Visit it in person to unlock it before adding a pin here.
              </span>
            </div>
          )}

          {uploadError && (
            <div className="flex items-start gap-2 rounded-lg border border-muted-foreground/30 bg-muted px-3 py-2 text-sm text-muted-foreground">
              <ImageOff className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {uploadError} You can still create the pin now and add a photo later.
              </span>
            </div>
          )}

          {/* User's own name/description — separate from the place info above. */}
          <PinFormFields
            name={pinName}
            setName={handlePinNameChange}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            description={pinDescription}
            setDescription={setPinDescription}
            imageUrl={imageUrl}
            setImageUrl={setImageUrl}
            onUploadError={setUploadError}
          />

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={resetForm}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isBlocked}>
              Create Pin
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

export default AddPinPanel
