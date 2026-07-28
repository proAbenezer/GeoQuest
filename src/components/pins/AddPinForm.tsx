import { useState, useEffect } from "react"
import { useSidebar } from "@/components/ui/sidebar"
import { usePins } from "@/context/usePins"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { useLocationSearch } from "@/hooks/useLocationSearch"
import LocationSearchField from "./LocationSearchField"
import LocationPreview from "@/components/pins/LocationPreview"
import PinFormFields from "@/components/pins/PinFormFields"

const AddPinPanel = () => {
  const { state } = useSidebar()
  const {
    addPin,
    secondaryPanel,
    setSecondaryPanel,
    prefillLocation,
    setPrefillLocation,
  } = usePins()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const search = useLocationSearch(prefillLocation)
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
    setName(prefillLocation.placeName)
    setPrefillLocation(null)
  }, [prefillLocation, setPrefillLocation])

  if (!isOpen) return null

  function resetForm() {
    setName("")
    setDescription("")
    setCategoryId("")
    setImageUrl("")
    search.reset()
    setSecondaryPanel(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!search.location)
      return alert("Please search and select a location first")
    if (!name.trim()) return alert("Please give the pin a name")
    if (!categoryId) return alert("Please select a category")
    addPin({
      name,
      description,
      visitDate: null,
      visited: false,
      latitude: search.location.latitude,
      longitude: search.location.longitude,
      categoryId,
      imageUrl: imageUrl.trim() || undefined,
    })
    resetForm()
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
        <LocationPreview location={search.location} />
        <PinFormFields
          name={name}
          setName={setName}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
          description={description}
          setDescription={setDescription}
          imageUrl={imageUrl}
          setImageUrl={setImageUrl}
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
          <Button type="submit" className="flex-1">
            Create Pin
          </Button>
        </div>
      </form>
    </div>
  )
}

export default AddPinPanel
