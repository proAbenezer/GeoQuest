// pages/StatsPage.tsx
// Travel-stats dashboard (item 14, full Phase 1 + 2). Reads the materialized
// per-user summary from GET /stats and renders: headline numbers, a shaded
// world map, places-by-country bars, a sortable per-country breakdown, and a
// category breakdown. Empty state for identities with no check-ins yet.
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Globe2,
  MapPin,
  CalendarDays,
  Flame,
  RefreshCw,
  Loader2,
  Plane,
  ArrowLeft,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTravelStats } from "@/hooks/useTravelStats"
import WorldMap from "@/components/stats/WorldMap"
import StatsChart from "@/components/stats/StatsChart"
import type { CountryStat } from "@/types/place"

type SortKey = "places" | "days" | "name"

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof MapPin
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-3xl font-bold leading-none tabular-nums">{value}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function StatsPage() {
  const { data, loading, error, refresh } = useTravelStats()
  const [sortKey, setSortKey] = useState<SortKey>("places")
  const [sortAsc, setSortAsc] = useState(false)

  const sortedCountries = useMemo(() => {
    if (!data) return []
    const arr = [...data.countries]
    arr.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name)
      return a[sortKey] - b[sortKey]
    })
    if (sortAsc) arr.reverse()
    return arr
  }, [data, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
    >
      {label}
      {sortKey === k && <span className="text-foreground">{sortAsc ? "▲" : "▼"}</span>}
    </button>
  )

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to map
        </Link>
        <div className="flex min-h-[50vh] items-center justify-center">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : error ? (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={refresh}>Retry</Button>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const { summary, countries, streak, categories } = data

  if (summary.totalPlaces === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to map
        </Link>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
          <Plane className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No travels yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your travel stats will appear here once you check in somewhere. Head to the map and
            let your location be detected, or tap{" "}
            <span className="font-medium text-foreground">Check in</span>.
          </p>
          <Link to="/">
            <Button>Go to map</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to map
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your travel stats</h1>
        <Button variant="ghost" size="sm" onClick={refresh} className="gap-1">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Headline numbers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Countries visited" value={summary.countriesVisited} icon={Globe2} />
        <StatCard label="Places visited" value={summary.totalPlaces} icon={MapPin} />
        <StatCard label="Days traveled" value={summary.totalDays} icon={CalendarDays} />
        <StatCard
          label={streak ? `Longest streak · ${streak.name}` : "Longest streak"}
          value={streak ? `${streak.longestDays}d` : "—"}
          icon={Flame}
        />
      </div>

      {/* World map + bar chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">World</CardTitle>
          </CardHeader>
          <CardContent className="h-64 p-0">
            <WorldMap />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Places by country</CardTitle>
          </CardHeader>
          <CardContent>
            <StatsChart countries={countries} />
          </CardContent>
        </Card>
      </div>

      {/* Sortable per-country breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2">
                    <SortHeader label="Country" k="name" />
                  </th>
                  <th className="px-4 py-2 text-right">
                    <SortHeader label="Places" k="places" />
                  </th>
                  <th className="px-4 py-2 text-right">
                    <SortHeader label="Days" k="days" />
                  </th>
                  <th className="px-4 py-2 text-right">Explored</th>
                  <th className="px-4 py-2 text-right">First visit</th>
                  <th className="px-4 py-2 text-right">Last visit</th>
                </tr>
              </thead>
              <tbody>
                {sortedCountries.map((c: CountryStat) => (
                  <tr key={c.iso2} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.continent ?? c.iso2}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.places}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.days}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {c.explorationPercent != null ? `${c.explorationPercent}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {formatDate(c.firstVisitAt)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {formatDate(c.lastVisitAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {categories.map((c, i) => (
                <span
                  key={`${i}-${c.name}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm"
                >
                  {c.name}
                  <span className="text-xs text-muted-foreground">{c.count}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
