import { useState } from "react"
import { Input } from "@/components/ui/input"
import type { Pin } from "@/types"

interface SavedPlaceFormProps {
  availablePins: Pin[]
  onAdd: (id: string) => void
}

const SavedPlaceForm = ({ availablePins, onAdd }: SavedPlaceFormProps) => {
  const [query, setQuery] = useState("")

  const filtered = query.trim()
    ? availablePins.filter((p) =>
        p.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : availablePins

  return (
    <div className="space-y-2 border-b pb-3">
      <Input
        placeholder="Search pins to save..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() && (
        <div className="max-h-40 overflow-y-auto rounded-md border">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No matching pins.
            </p>
          ) : (
            filtered.map((pin) => (
              <button
                key={pin.id}
                onClick={() => {
                  onAdd(pin.id)
                  setQuery("")
                }}
                className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {pin.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default SavedPlaceForm
