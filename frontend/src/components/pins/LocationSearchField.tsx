import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Suggestion } from "@/types/location"

type Props = {
  containerRef: React.RefObject<HTMLDivElement | null>
  searchQuery: string
  suggestions: Suggestion[]
  showSuggestions: boolean
  onInputChange: (value: string) => void
  onInputKeyDown: (e: React.KeyboardEvent) => void
  onSelect: (s: Suggestion) => void
  onFocus: () => void
}

const LocationSearchField = ({
  containerRef,
  searchQuery,
  suggestions,
  showSuggestions,
  onInputChange,
  onInputKeyDown,
  onSelect,
  onFocus,
}: Props) => (
  <div ref={containerRef} className="relative space-y-2">
    <Label>Find Location</Label>
    <Input
      value={searchQuery}
      onChange={(e) => onInputChange(e.target.value)}
      onKeyDown={onInputKeyDown}
      onFocus={onFocus}
      placeholder="Search a place..."
    />
    {showSuggestions && suggestions.length > 0 && (
      <div className="absolute z-50 mt-1 w-full rounded-lg border bg-background shadow-lg">
        {suggestions.map((s) => (
          <button
            key={s.mapbox_id}
            type="button"
            onClick={() => onSelect(s)}
            className="flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
          >
            <span className="font-medium">{s.name}</span>
            {s.place_formatted && (
              <span className="text-xs text-muted-foreground">
                {s.place_formatted}
              </span>
            )}
          </button>
        ))}
      </div>
    )}
  </div>
)

export default LocationSearchField
