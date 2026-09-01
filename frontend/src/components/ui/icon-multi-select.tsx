// components/ui/icon-multi-select.tsx
import { X } from "lucide-react"
import { ICON_CATALOG, ICON_IDENTIFIERS } from "@/lib/categoryDisplay"
import type { LucideIcon } from "lucide-react"

interface IconMultiSelectProps {
  value: string[]
  onChange: (icons: string[]) => void
}

// A pin or category can carry at most two icons — enough for a small stack,
// but no more (matches "don't allow more than two").
const MAX_ICONS = 2

/**
 * Icon picker for categories and pins. Up to MAX_ICONS icons can be chosen; the
 * grid below toggles them on/off, and picks past the cap are ignored.
 */
export function IconMultiSelect({ value, onChange }: IconMultiSelectProps) {
  const atCap = value.length >= MAX_ICONS
  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else if (!atCap) {
      onChange([...value, id])
    }
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const Icon: LucideIcon | null = ICON_CATALOG[id] ?? null
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary"
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {id}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="rounded-full p-0.5 hover:bg-primary/20"
                  aria-label={`Remove ${id} icon`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
      <div className="grid grid-cols-6 gap-1">
        {ICON_IDENTIFIERS.map((id) => {
          const Icon: LucideIcon = ICON_CATALOG[id]
          const active = value.includes(id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              title={active ? id : atCap ? `Remove an icon to pick ${id}` : id}
              aria-pressed={active}
              className={`flex items-center justify-center rounded-lg p-1.5 transition-colors ${
                active
                  ? "text-primary"
                  : atCap
                    ? "cursor-not-allowed text-muted-foreground/30"
                    : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>
      {atCap && (
        <p className="text-[11px] text-muted-foreground/70">
          Maximum of {MAX_ICONS} icons — remove one to pick another.
        </p>
      )}
    </div>
  )
}
