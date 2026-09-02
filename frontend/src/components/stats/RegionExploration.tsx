// components/stats/RegionExploration.tsx
// Deep-dive card for the user's most-explored country (e.g. Ethiopia): a ring
// with the country's overall explored %, plus a progress bar per top-level
// region (ADM1). Percentages are the SAME server-persisted roll-up the map's
// exploration bar reads — this just turns it into a picture. Region rows come
// from GET /places/exploration?iso2=… keyed to the shared places tree the page
// already seeds (allPlaces), so no duplicate downloads.
import { useEffect, useMemo, useState } from "react"
import { Map as MapIcon } from "lucide-react"
import { fetchExplorationPlaces } from "@/lib/api"
import type { Place } from "@/types/place"
import { formatExplorePercent } from "@/components/layout/sidebar/ExploreProgress"
import { StatPanel } from "./StatPanel"

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
  iso2,
  name,
  overall,
  unlockedIds,
  places,
}: {
  iso2: string
  name: string
  overall: number | null
  unlockedIds: Set<string>
  places: Place[]
}) {
  const [percentById, setPercentById] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchExplorationPlaces(iso2)
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
  }, [iso2])

  const { root, regions, leavesTotal, leavesUnlocked } = useMemo(() => {
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
  }, [places, iso2, unlockedIds, percentById])

  const ringPercent = overall != null ? overall : root ? (percentById.get(root.id) ?? 0) : 0

  return (
    <StatPanel
      icon={MapIcon}
      title="Region exploration"
      subtitle={name}
      className="h-full"
      bodyClassName="flex flex-col"
    >
      {/* Ring + headline always render once we have anything to show (a loaded
          country with no ADM1 model — e.g. a non-Ethiopia country — still has a
          real overall number). Region bars are only meaningful when the tree has
          child regions. */}
      <div className="flex items-center gap-4 border-b border-border/40 pb-3">
        <Ring percent={ringPercent} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-foreground">{name} explored</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {root
              ? `${leavesUnlocked}/${leavesTotal} area${leavesTotal === 1 ? "" : "s"} unlocked${
                  regions.length ? ` across ${regions.length} region${regions.length === 1 ? "" : "s"}` : ""
                }`
              : loading
                ? "Loading region data…"
                : "Region data isn't available yet for this country."}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            {overall == null ? "no exploration data yet" : "percent shown is area-weighted"}
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
