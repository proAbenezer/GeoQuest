// components/stats/StatsChart.tsx
// Hand-rolled horizontal bar chart of places-per-country for the stats
// dashboard — plain divs + CSS widths, no chart dependency (npm install is
// unavailable, so recharts etc. are out). Sorted by count, most first.
import type { CountryStat } from "@/types/place"

export default function StatsChart({ countries }: { countries: CountryStat[] }) {
  const sorted = [...countries].sort((a, b) => b.places - a.places)
  const max = Math.max(1, ...sorted.map((c) => c.places))

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((c) => (
        <div key={c.iso2} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-right text-sm text-muted-foreground">
            {c.name}
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded-r bg-[#00B47B]"
              style={{ width: `${(c.places / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-sm tabular-nums">{c.places}</span>
        </div>
      ))}
    </div>
  )
}
