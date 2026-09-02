// components/stats/RegionExploration.tsx
// Two-pane international exploration card for the stats dashboard.
//
// Overview: every country the traveler has check-ins in, ranked by places —
// flag, name, and the SAME server-persisted area-weighted rollup (per-country
// root percent from GET /stats) that the world map reads. No extra fetches.
// Tap a row to drill into that country: a ring with its overall explored %,
// plus one progress bar per top-level region (ADM1). The region rows come from
// GET /places/exploration?iso2=… keyed to the shared places tree the page
// already seeds (allPlaces), so no duplicate downloads. Both views are driven
// entirely by the per-country data the server already returns — nothing here
// assumes a particular country or admin depth.
import { useEffect, useMemo, useState } from "react"
import { Map as MapIcon, ChevronRight, ArrowLeft } from "lucide-react"
import { fetchExplorationPlaces } from "@/lib/api"
import type { CountryStat, Place } from "@/types/place"
import { formatExplorePercent } from "@/components/layout/sidebar/ExploreProgress"
import { StatPanel } from "./StatPanel"

// Flag emoji from an ISO 3166-1 alpha-2 code (regional-indicator symbols), so
// every country renders without shipping any flag assets.
function countryFlag(iso2: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso2)) return ""
  const base = 127397 // U+1F1E6 'A'
  return String.fromCodePoint(...iso2.toUpperCase().split("").map((ch) => base + ch.charCodeAt(0)))
}

function Ring({ percent, size = 88 }: { percent: number | null; size?: number }) {
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const filled = percent == null ? 0 : Math.min(100, Math.max(0, percent)) / 100
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="text-muted"
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - filled)}
          strokeLinecap="round"
          className="text-primary transition-all duration-500"
          stroke="currentColor"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-foreground">
        {percent == null ? "–" : formatExplorePercent(percent)}
      </span>
    </div>
  )
}

export default function RegionExploration({
  countries,
  unlockedIds,
  places,
}: {
  countries: CountryStat[]
  unlockedIds: Set<string>
  places: Place[]
}) {
  // null = overview (all countries); an iso2 = drilling into that country.
  const [selectedIso2, setSelectedIso2] = useState<string | null>(null)
  const [percentById, setPercentById] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(false)

  const ranked = useMemo(
    () => [...countries].sort((a, b) => b.places - a.places || a.name.localeCompare(b.name)),
    [countries],
  )
  const selected = selectedIso2 ? (countries.find((c) => c.iso2 === selectedIso2) ?? null) : null

  // Fetch per-node exploration only while drilling into a specific country.
  useEffect(() => {
    if (!selectedIso2) {
      setPercentById(new Map())
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setPercentById(new Map())
    fetchExplorationPlaces(selectedIso2)
      .then((data) => {
        if (cancelled) return
        setPercentById(new Map(data.entries.map((e) => [e.placeId, e.percent])))
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedIso2])

  const { root, regions, leavesTotal, leavesUnlocked } = useMemo(() => {
    const iso2 = selected?.iso2 ?? ""
    const main = places.filter((p) => p.countryCode === iso2)
    const byId = new Map(main.map((p) => [p.id, p]))
    const childrenOf = new Map<string, string[]>()
    for (const p of main) {
      if (p.parentId && byId.has(p.parentId)) {
        const arr = childrenOf.get(p.parentId) ?? []
        arr.push(p.id)
        childrenOf.set(p.parentId, arr)
      }
    }

    const countLeaves = (id: string): { total: number; unlocked: number } => {
      const kids = childrenOf.get(id)
      if (!kids || kids.length === 0) {
        return { total: 1, unlocked: unlockedIds.has(id) ? 1 : 0 }
      }
      let total = 0
      let unlocked = 0
      for (const k of kids) {
        const s = countLeaves(k)
        total += s.total
        unlocked += s.unlocked
      }
      return { total, unlocked }
    }

    const root = main.find((p) => !p.parentId)
    const regions = root
      ? main
          .filter((p) => p.parentId === root.id)
          .sort((a, b) => {
            const pa = percentById.get(a.id) ?? 0
            const pb = percentById.get(b.id) ?? 0
            return pb - pa || a.name.localeCompare(b.name)
          })
      : []
    const rootStats = root ? countLeaves(root.id) : { total: 0, unlocked: 0 }

    return {
      root,
      regions,
      leavesTotal: rootStats.total,
      leavesUnlocked: rootStats.unlocked,
    }
    // percentById drives region ordering once entries arrive — recompute then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, selected, unlockedIds, percentById])

  // ---- Drill-in view: ring + per-region bars for the selected country ----
  if (selected) {
    const ringPercent =
      selected.explorationPercent != null
        ? selected.explorationPercent
        : root
          ? (percentById.get(root.id) ?? 0)
          : 0
    return (
      <StatPanel
        icon={MapIcon}
        title="Region exploration"
        subtitle={`${selected.name}${selected.continent ? ` · ${selected.continent}` : ""}`}
        className="h-full"
        bodyClassName="flex flex-col"
        action={
          <button
            type="button"
            onClick={() => setSelectedIso2(null)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All countries
          </button>
        }
      >
        {/* Ring + headline always render once we have anything to show (a loaded
            country whose tree has no ADM1 children still has a real overall
            number). Region bars are only meaningful when the tree has children. */}
        <div className="flex items-center gap-4 border-b border-border/40 pb-3">
          <Ring percent={ringPercent} />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-foreground">
              {selected.name} explored
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {root
                ? `${leavesUnlocked}/${leavesTotal} area${leavesTotal === 1 ? "" : "s"} unlocked${
                    regions.length
                      ? ` across ${regions.length} region${regions.length === 1 ? "" : "s"}`
                      : ""
                  }`
                : loading
                  ? "Loading region data…"
                  : "Region data isn't available yet for this country."}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {selected.explorationPercent == null
                ? "no exploration data yet"
                : "percent shown is area-weighted"}
            </p>
          </div>
        </div>

        {regions.length > 0 && (
          <div className="mt-3 flex max-h-[19rem] flex-col gap-2.5 overflow-y-auto pr-1">
            {regions.map((region) => {
              const pct = percentById.get(region.id)
              const pctValue = pct ?? 0
              return (
                <div key={region.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-foreground">
                      {region.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {pct == null ? "—" : formatExplorePercent(pct)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${Math.min(100, pctValue)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </StatPanel>
    )
  }

  // ---- Overview view: every visited country, ranked ----
  return (
    <StatPanel
      icon={MapIcon}
      title="Region exploration"
      subtitle={
        ranked.length
          ? `${ranked.length} countr${ranked.length === 1 ? "y" : "ies"} explored — tap one for its regions`
          : "No countries yet"
      }
      className="h-full"
      bodyClassName="flex flex-col"
    >
      {ranked.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Check in somewhere to start exploring countries.
        </p>
      ) : (
        <ol className="flex max-h-[21rem] flex-col overflow-y-auto pr-1">
          {ranked.map((c, i) => {
            const pct = c.explorationPercent
            return (
              <li
                key={c.iso2}
                className={i !== ranked.length - 1 ? "border-b border-border/40" : ""}
              >
                <button
                  type="button"
                  onClick={() => setSelectedIso2(c.iso2)}
                  className="group flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/40 text-base">
                    {countryFlag(c.iso2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {pct == null ? "—" : formatExplorePercent(pct)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/80"
                          style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                        {c.places} place{c.places === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </StatPanel>
  )
}
