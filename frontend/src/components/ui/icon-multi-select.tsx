// components/ui/icon-multi-select.tsx
import { X } from "lucide-react"
import { ICON_CATALOG, ICON_IDENTIFIERS } from "@/lib/categoryDisplay"
import type { LucideIcon } from "lucide-react"

interface IconMultiSelectProps {
  value: string[]
  onChange: (icons: string[]) => void
}

/**
 * Multi-select icon picker for categories and pins. Selected identifiers are
 * shown as removable chips; the grid below toggles them on/off. Replaces the
 * (previously nonexistent) single icon picker with an array-based multi-select.
 */
export function IconMultiSelect({ value, onChange }: IconMultiSelectProps) {
  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
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
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-primary/20"
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
              title={id}
              aria-pressed={active}
              className={`flex items-center justify-center rounded-lg p-1.5 transition-colors ${
                active
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
