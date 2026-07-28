import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { usePins } from "@/context/usePins"
import SavedPlaceForm from "./SavedPlaceForm"
import SavedPlaceListItem from "./SavedPlaceListItem"

const SavedPlacesManagerDialog = () => {
  const { pins, toggleSaved, isManagingSaved, setIsManagingSaved } = usePins()
  const savedPins = pins.filter((p) => p.saved)
  const unsavedPins = pins.filter((p) => !p.saved)

  return (
    <Dialog open={isManagingSaved} onOpenChange={setIsManagingSaved}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Saved Places</DialogTitle>
        </DialogHeader>

        <SavedPlaceForm availablePins={unsavedPins} onAdd={toggleSaved} />

        {savedPins.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No saved places yet.
          </p>
        ) : (
          <div className="rounded-md border">
            {savedPins.map((pin) => (
              <SavedPlaceListItem
                key={pin.id}
                pin={pin}
                onRemove={toggleSaved}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default SavedPlacesManagerDialog
