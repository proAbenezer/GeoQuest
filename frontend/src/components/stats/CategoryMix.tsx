// components/stats/CategoryMix.tsx
// Ranked horizontal bars of the identity's pins grouped by category — the same
// data the old page rendered as small chips, now visual and comparable.
import { Tag } from "lucide-react"
import { StatPanel } from "./StatPanel"

export default function CategoryMix({
  categories,
}: {
  categories: { name: string; count: number }[]
}) {
  const sorted = [...categories].sort((a, b) => b.count - a.count)
  const max = Math.max(1, ...sorted.map((c) => c.count))

  return (
    <StatPanel
      icon={Tag}
      title="Category mix"
      subtitle={sorted.length ? "Your pinned places by category" : "No pinned places yet"}
      className="h-full"
    >
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Pin places from the map to build your category mix.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.slice(0, 8).map((c) => (
            <div key={c.name} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{c.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/80"
                  style={{ width: `${Math.max(4, (c.count / max) * 100)}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-foreground">
                {c.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </StatPanel>
  )
}
