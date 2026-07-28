import { Bookmark } from "lucide-react"
import type { Pin } from "@/types"

const SavedPlaceListItem = ({
  pin,
  onRemove,
}: {
  pin: Pin
  onRemove: (id: string) => void
}) => (
  <div className="flex items-center justify-between px-4 py-3 border-b last:border-b-0">
    <span className="text-sm">{pin.name}</span>
    <button onClick={() => onRemove(pin.id)}>
      <Bookmark className="h-4 w-4 fill-current text-orange-500" />
    </button>
  </div>
)

export default SavedPlaceListItem
