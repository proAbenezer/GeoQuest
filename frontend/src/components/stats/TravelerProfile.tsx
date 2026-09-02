// components/stats/TravelerProfile.tsx
// "Traveler profile" band — the story behind the four hero numbers: when the
// journey started, when it was last active, the average unlock pace, and the
// single most-explored country. Purely derived from the materialized summary +
// per-country rows already returned by GET /stats.
import { CalendarDays, Clock, Activity, Trophy } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { CountryStat } from "@/types/place"
import { StatPanel } from "./StatPanel"

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function Fact({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-muted/40 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold leading-tight text-foreground">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{hint}</p>}
      </div>
    </div>
  )
}

export default function TravelerProfile({
  summary,
  countries,
}: {
  summary: { firstVisitAt: string | null; lastVisitAt: string | null; totalPlaces: number; totalDays: number }
  countries: CountryStat[]
}) {
  const pace =
    summary.totalDays > 0 ? (summary.totalPlaces / summary.totalDays).toFixed(1) : "—"
  const top = countries.length
    ? [...countries].sort((a, b) => b.places - a.places)[0]
    : null

  return (
    <StatPanel icon={Trophy} title="Traveler profile" subtitle="Your journey at a glance">
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        <Fact icon={CalendarDays} label="First check-in" value={formatDate(summary.firstVisitAt)} />
        <Fact icon={Clock} label="Last check-in" value={formatDate(summary.lastVisitAt)} />
        <Fact
          icon={Activity}
          label="Avg. unlocks per active day"
          value={pace === "—" ? "—" : `${pace}/day`}
          hint={summary.totalDays > 0 ? `across ${summary.totalDays} active day${summary.totalDays === 1 ? "" : "s"}` : "no active days yet"}
        />
        <Fact
          icon={Trophy}
          label="Most explored"
          value={top ? top.name : "—"}
          hint={top ? `${top.places} place${top.places === 1 ? "" : "s"} unlocked` : "no unlocks yet"}
        />
      </div>
    </StatPanel>
  )
}
