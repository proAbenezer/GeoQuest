import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { IconStack } from "@/components/ui/icon-stack"
import { getCategoryIcon, getIconList } from "@/lib/categoryDisplay"
import type { Category } from "@/types"

type PinVisibility = "all" | "pinned" | "unpinned"

interface FilterPanelProps {
  categories: Category[]
  activeCategoryIds: string[]
  onToggle: (categoryId: string) => void
  onClear: () => void
  onClose: () => void
  pinVisibility: PinVisibility
  onVisibilityChange: (mode: PinVisibility) => void
  className?: string
}

export default function FilterPanel({
  categories,
  activeCategoryIds,
  onToggle,
  onClear,
  onClose,
  pinVisibility,
  onVisibilityChange,
  className = "",
}: FilterPanelProps) {
  return (
    <div
      className={`rounded-xl border border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-xl p-2 ${className}`}
    >
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Filter by category</span>
        {activeCategoryIds.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-primary hover:underline"
          >
            Clear
          </button>
        )}
      </div>
      {/* ---- Visibility toggle ---- */}
      <div className="flex items-center gap-1 p-1 mb-2 rounded-lg bg-muted/40">
        {(["all", "pinned", "unpinned"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onVisibilityChange(mode)}
            className={`flex-1 text-xs py-1 rounded-md capitalize transition-colors ${
              pinVisibility === mode
                ? "bg-primary/20 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {mode === "all" ? "All" : mode === "pinned" ? "Saved" : "Nearby"}
          </button>
        ))}
      </div>
      {categories.map((category) => (
        <label
          key={category.id}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 cursor-pointer text-sm"
        >
          <Checkbox
            checked={activeCategoryIds.includes(category.id)}
            onCheckedChange={() => onToggle(category.id)}
          />
          <IconStack
            icons={getIconList(category.icons, getCategoryIcon(category.id))}
            size="h-3.5 w-3.5"
            max={2}
            className="text-muted-foreground"
          />
          {category.name}
        </label>
      ))}
      <div className="flex justify-end pt-1">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}
