// components/pins/AddPinForm.tsx
import { useState, useEffect, useMemo } from "react"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { Button } from "@/components/ui/button"
import { X, Lock, Tag, ImageOff, MapPin } from "lucide-react"
import { useLocationSearch } from "@/hooks/useLocationSearch"
import { usePlaceLookup } from "@/hooks/usePlaceLookup"
import { usePanelManager } from "@/hooks/usePanelManager"
import { useRecentlyVisited } from "@/hooks/useRecentlyVisited"
import LocationSearchField from "./LocationSearchField"
import LocationPreview from "@/components/pins/LocationPreview"
import PinFormFields from "@/components/pins/PinFormFields"
import CategoryForm from "@/components/layout/category/CategoryForm"
import SidePanel from "@/components/layout/sidebar/SidePanel"

const AddPinPanel = () => {
  const {
    addPin,
    secondaryPanel,
    setSecondaryPanel,
    prefillLocation,
    setPrefillLocation,
    setHighlightedPinId,
    setFlyToTarget,
  } = usePins()
  const { closeAllPanels } = usePanelManager()
  const { markAsPinned } = useRecentlyVisited()
  const { categories, loading: categoriesLoading, addCategory } = useCategories()

  const recentlyVisitedId = secondaryPanel?.type === "addPin" ? secondaryPanel.recentlyVisitedId : null

  const [pinName, setPinName] = useState("")
  const [pinDescription, setPinDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [pinIcons, setPinIcons] = useState<string[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)

  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const [newCategoryIcons, setNewCategoryIcons] = useState<string[]>([])
  const [, setCreatingCategory] = useState(false)
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
  }, [isOpen, prefillLocation])

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
    setPinIcons([])
    setUploadError(null)
    setImageUploading(false)
    setNameTouched(false)
    search.reset()
    closeAllPanels()
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
        icons: newCategoryIcons,
      })
      setCategoryId(category.id)
      setNewCategoryName("")
      setNewCategoryDescription("")
      setNewCategoryIcons([])
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
      const newPin = await addPin({
        name: search.location.placeName,
        description: search.location.address,
        customName: pinName.trim() || null,
        customDescription: pinDescription.trim() || null,
        visitDate: null,
        visited: false,
        latitude: search.location.latitude,
        longitude: search.location.longitude,
        categoryId,
        placeId: placeCheck.placeId,
        imageUrl: imageUrl.trim() || undefined,
        icons: pinIcons,
      })

      if (recentlyVisitedId) {
        await markAsPinned(recentlyVisitedId, newPin.id)
      }

      // Clear the form for the next pin, then open the new pin's detail panel
      // so the user lands on the pin they just created (instead of the panel
      // closing back to the map).
      setPinName("")
      setPinDescription("")
      setCategoryId("")
      setImageUrl("")
      setPinIcons([])
      setUploadError(null)
      setImageUploading(false)
      setNameTouched(false)
      search.reset()
      setPrefillLocation(null)
      setHighlightedPinId(newPin.id)
      setFlyToTarget({ latitude: newPin.latitude, longitude: newPin.longitude })
      setSecondaryPanel({ type: "pinDetail", pin: newPin })
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create pin")
    }
  }

  return (
    <SidePanel
      widthClassName="w-80"
      onOpenChange={(open) => {
        if (!open) setSecondaryPanel(null)
      }}
    >
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
              <MapPin className="h-4 w-4" />
            </div>
            <span className="font-heading text-lg font-semibold tracking-tight">Add New Pin</span>
          </div>
          <button
            onClick={resetForm}
            className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-4 space-y-3">
        {hasNoCategories ? (
          <>
            <div className="flex items-start gap-2 px-2 pt-2 text-sm text-primary">
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
              icons={newCategoryIcons}
              setIcons={setNewCategoryIcons}
              onSubmit={handleCreateFirstCategory}
            />
            {categoryError && (
              <p className="px-2 text-sm text-destructive">{categoryError}</p>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {!cameFromMapClick && (
              <div className="rounded-xl border bg-card/50 p-3 space-y-2">
                <div className="flex items-center gap-2 px-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider">Find Location</h3>
                </div>
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
              </div>
            )}

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

            <div className="rounded-xl border bg-card/50 p-3 space-y-3">
              <PinFormFields
                name={pinName}
                setName={handlePinNameChange}
                categoryId={categoryId}
                setCategoryId={setCategoryId}
                description={pinDescription}
                setDescription={setPinDescription}
                imageUrl={imageUrl}
                setImageUrl={setImageUrl}
                icons={pinIcons}
                setIcons={setPinIcons}
                onUploadError={setUploadError}
                onUploadingChange={setImageUploading}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={resetForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isBlocked || imageUploading}
              >
                {imageUploading ? "Uploading photo…" : "Create Pin"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </SidePanel>
  )
}

export default AddPinPanel
