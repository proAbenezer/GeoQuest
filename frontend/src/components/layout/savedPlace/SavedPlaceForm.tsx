// components/layout/savedPlace/SavedPlaceForm.tsx
import { Plus } from "lucide-react"
import type { Pin } from "@/types"

const SavedPlaceForm = ({
  availablePins,
  onAdd,
}: {
  availablePins: Pin[]
  onAdd: (id: string) => Promise<void>
}) => {
  if (availablePins.length === 0) {
    return (
      <p className="py-2 text-center text-sm text-muted-foreground">
        No unsaved pins to add. Create a pin first!
      </p>
    )
  }

  return (
    <div className="space-y-0.5 max-h-52 overflow-y-auto">
      {availablePins.map((pin) => (
        <button
          key={pin.id}
          onClick={() => onAdd(pin.id)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all hover:bg-muted/50"
        >
          <span className="truncate">{pin.name}</span>
          <Plus className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-colors hover:text-primary" />
        </button>
      ))}
    </div>
  )
}

export default SavedPlaceForm
