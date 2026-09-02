// hooks/useExploreProgress.ts
//
// Feeds the sidebar's exploration bar. Reads the persisted per-node roll-up
// from the server (GET /places/exploration — the client never recomputes the
// hierarchy), then picks which region to display:
//
//   - Live GPS fix (geolocate on): the region you are physically in, shown at
//     the ZOOM's granularity. The fix anchors an ancestor chain country → …
//     → the place underfoot; of that chain the bar shows the BIGGEST region that
//     is FULLY on screen. Zoomed out over all of Ethiopia → "Ethiopia Explored";
//     zoomed to Addis Ababa → "Addis Ababa Explored"; zoomed into the sub-city
//     you stand in (Yeka) → "Yeka Explored". Because the base is your location,
//     the map centre drifting over a neighbouring region (a North Shewa zone)
//     can never steal the label — zooming is what moves the bar up the chain.
//   - No GPS yet: follow the map viewport (what's on screen):
//       - No viewport (map not loaded / not on the map route): the country's
//         aggregate ("Ethiopia Explored").
//       - The viewport centre's ancestor chain (root → deepest containing
//         place): pick the DEEPEST ancestor whose footprint is at least ~half
//         on screen (a visible-fraction rule, not a strict "fully contained"
//         test). So zooming out climbs toward the whole country and zooming in
//         descends to the smallest region that's mostly visible — a region at
//         ~90% on screen with neighbour edges peeking in (e.g. Addis Ababa) is
//         still selected.
//       - Otherwise (deep zoom into part of a region, nothing ≥ half visible):
//         fall back to leaf-level detail SCOPED to the deepest centre-ancestor's
//         subtree, so the aggregate never mixes in neighbouring regions.
//
// Granularity is generic — driven entirely by the self-referencing places tree,
// never a hardcoded admin depth. "Fully on screen" and the viewport branch's
// "footprint" both approximate a division by the bbox of its boundary geometry
// (flagged deliberately — exact polygon tests per pan/zoom would be far
// heavier). The GPS branch does one exact point-in-polygon test per fix over
// the handful of top-level regions to anchor the chain, then bbox tests below.
import { useMemo, useState, useEffect, useRef } from "react"
import * as turf from "@turf/turf"
import { usePins } from "@/context/usePins"
import { useCountryPlaces } from "@/hooks/useCountryPlaces"
import { fetchExplorationPlaces } from "@/lib/api"
import type { ExplorationEntry } from "@/types/place"

type BBox = [number, number, number, number] // [minLng, minLat, maxLng, maxLat]

export type ExploreProgress = {
  title: string
  percent: number
} | null

// Delay before re-reading after an unlock: the server recomputes the roll-up
// AFTER responding to POST /places/unlock, so an immediate read can race it.
const RE_READ_DELAY_MS = 400

// Region-selection thresholds (hysteresis). VISIBLE_GAIN is what a NEW region
// needs on screen to be picked when you zoom into it; VISIBLE_KEEP is what the
// PREVIOUSLY picked region still needs to stay selected. The gap between them
// stops the label from flipping at a boundary: a small pan across a region edge
// keeps "Addis Ababa Explored" while Addis is at ~45-49% on screen, instead of
// bouncing to the country or a neighbor.
const VISIBLE_GAIN = 0.5
const VISIBLE_KEEP = 0.45

function geometryBbox(geom: any): BBox | null {
  if (!geom?.type) return null
  let polys: any[]
  if (geom.type === "Polygon") polys = [geom.coordinates]
  else if (geom.type === "MultiPolygon") polys = geom.coordinates
  else return null

  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const poly of polys) {
    for (const ring of poly ?? []) {
      for (const [lng, lat] of ring ?? []) {
        if (typeof lng !== "number" || typeof lat !== "number") continue
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }
  }
  return minLng === Infinity ? null : [minLng, minLat, maxLng, maxLat]
}

function bboxArea(bb: BBox): number {
  return (bb[2] - bb[0]) * (bb[3] - bb[1])
}

// a's bbox overlaps the viewport bbox.
function bboxIntersects(a: BBox, viewport: BBox): boolean {
  return a[0] <= viewport[2] && a[2] >= viewport[0] && a[1] <= viewport[3] && a[3] >= viewport[1]
}

// Fraction of a's bbox area that lies inside the viewport bbox (0..1) — the
// selection heuristic's metric (see the header comment for why bbox is enough).
function bboxVisibleFraction(a: BBox, viewport: BBox): number {
  const area = bboxArea(a)
  if (area === 0) return 0
  const interW = Math.min(a[2], viewport[2]) - Math.max(a[0], viewport[0])
  const interH = Math.min(a[3], viewport[3]) - Math.max(a[1], viewport[1])
  if (interW <= 0 || interH <= 0) return 0
  return (interW * interH) / area
}

// a's bbox sits entirely inside the viewport bbox → the region is FULLY on
// screen (its bounding box is a superset of it, so the region itself is too).
// The GPS branch uses this: of the location's ancestor chain, the biggest
// region you can currently see whole is the one worth showing (see the header).
function bboxFullyVisible(a: BBox, viewport: BBox): boolean {
  return a[0] >= viewport[0] && a[1] >= viewport[1] && a[2] <= viewport[2] && a[3] <= viewport[3]
}

// Every leaf in the subtree rooted at `rootId` (the root itself when it's a
// leaf). Runs only on the deep-zoom fallback, where the subtree is small.
function collectLeavesUnder(rootId: string, children: Map<string, string[]>): string[] {
  const leaves: string[] = []
  const stack = [rootId]
  while (stack.length > 0) {
    const id = stack.pop()!
    const kids = children.get(id)
    if (!kids || kids.length === 0) leaves.push(id)
    else stack.push(...kids)
  }
  return leaves
}

// Everything about a cached country that is independent of the viewport. Built
// once per country tree / roll-up change — never on pan/zoom (the old layout
// re-parsed every boundary GeoJSON string on every map move, which is what made
// panning heavy).
type CountryIndex = {
  rootId: string
  countryTitle: string
  children: Map<string, string[]>
  nameById: Map<string, string>
  bboxCache: Map<string, BBox | null>
  // Parsed boundary geometry of the country's TOP-LEVEL regions (children of
  // the root). The GPS branch tests the live fix against these exactly (a
  // handful of polygons per fix — cheap) to say which region you are in.
  topLevel: { id: string; geom: any }[]
  entryFor: (id: string) => ExplorationEntry
}

export function useExploreProgress(): ExploreProgress {
  const { countryIso2, mapBounds, viewportCenter, gpsLocation, unlockCount } = usePins()
  const { places, status: countryStatus } = useCountryPlaces(countryIso2)

  const [entries, setEntries] = useState<ExplorationEntry[]>([])
  const entriesIso2 = useRef<string | null>(null)

  // Last region pick ({ id, iso2 } of the most recent "X Explored" selection).
  // The hysteresis branch reads it as the baseline: while that region is still
  // an ancestor of the viewport center and ≥ VISIBLE_KEEP visible, keep it.
  const prevPick = useRef<{ id: string; iso2: string } | null>(null)

  // Re-read persisted roll-up on country change and on each fresh unlock. Clear
  // immediately when the country switches so a stale country's entries are
  // never shown against another country's tree.
  useEffect(() => {
    if (!countryIso2) {
      setEntries([])
      entriesIso2.current = null
      return
    }
    // Only read the persisted roll-up once the country's boundary tree is
    // cached — GET /places/exploration returns [] before that, and reading
    // earlier would bake in an empty (0%) result. This also covers the first
    // load: the viewport-derived country kicks off a fetch (status "fetching"),
    // and this effect re-runs when it flips to "cached".
    if (countryStatus !== "cached") {
      if (entriesIso2.current !== countryIso2) setEntries([])
      return
    }
    let cancelled = false
    if (entriesIso2.current !== countryIso2) setEntries([])
    const timer = setTimeout(async () => {
      try {
        const data = await fetchExplorationPlaces(countryIso2)
        if (!cancelled) {
          setEntries(data.entries)
          entriesIso2.current = countryIso2
        }
      } catch {
        // keep previous entries; the next unlock/move retries
      }
    }, RE_READ_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [countryIso2, unlockCount, countryStatus])

  // Hysteresis baseline is per-country: clear the previous pick when the
  // country switches so a stale region from the last country can't bias the
  // next country's label. (The iso2 guard in the selection memo also covers the
  // one render that happens before this effect runs.)
  useEffect(() => {
    prevPick.current = null
  }, [countryIso2])

  const countryIndex = useMemo<CountryIndex | null>(() => {
    if (!places || places.length === 0) return null

    const entryMap = new Map(entries.map((e) => [e.placeId, e]))
    const entryFor = (id: string): ExplorationEntry =>
      entryMap.get(id) ?? { placeId: id, explored: false, percent: 0 }

    const children = new Map<string, string[]>()
    const nameById = new Map<string, string>()
    const idSet = new Set(places.map((p) => p.id))
    for (const p of places) {
      nameById.set(p.id, p.name)
      if (p.parentId && idSet.has(p.parentId)) {
        const arr = children.get(p.parentId) ?? []
        arr.push(p.id)
        children.set(p.parentId, arr)
      }
    }
    const roots = places.filter((p) => !p.parentId || !idSet.has(p.parentId))
    if (roots.length === 0) return null
    const rootId = roots[0].id // Ethiopia (and every cached country) has one root

    const bboxCache = new Map<string, BBox | null>()
    for (const p of places) {
      try {
        bboxCache.set(p.id, geometryBbox(JSON.parse(p.boundary)))
      } catch {
        bboxCache.set(p.id, null)
      }
    }

    // Parsed geometry of each top-level region (children of the root). Only
    // these ever need exact polygons — the GPS branch tests the live fix
    // against them for containment, where bbox point-in-box isn't enough.
    const placeById = new Map(places.map((p) => [p.id, p]))
    const topLevel: { id: string; geom: any }[] = []
    for (const id of children.get(rootId) ?? []) {
      const p = placeById.get(id)
      if (!p) continue
      try {
        topLevel.push({ id, geom: JSON.parse(p.boundary) })
      } catch {
        // skip — a top region without a parseable boundary just never wins GPS hits
      }
    }

    return {
      rootId,
      countryTitle: `${nameById.get(rootId)} Explored`,
      children,
      nameById,
      bboxCache,
      topLevel,
      entryFor,
    }
  }, [places, entries])

  return useMemo<ExploreProgress>(() => {
    if (!countryIndex || !countryIso2) return null
    const { rootId, countryTitle, children, nameById, bboxCache, topLevel, entryFor } =
      countryIndex

    // Live GPS fix present → the bar is the region you are PHYSICALLY in,
    // chosen at the ZOOM's granularity. The fix anchors a chain country → … →
    // the exact place underfoot: the root's child is found by exact polygon
    // (bbox is not reliable at borders), then each deeper child by bbox (the
    // same heuristic the viewport path uses). Of that chain, show the BIGGEST
    // region that currently fits ENTIRELY on screen — zoomed out over all of
    // Ethiopia → Ethiopia; zoomed to Addis Ababa → Addis Ababa; zoomed into a
    // sub-city → that sub-city. The centre drifting over a neighbouring region
    // (North Shewa) can never steal the label because the base is the fix.
    if (gpsLocation) {
      const glng = gpsLocation.longitude
      const glat = gpsLocation.latitude
      const pt = turf.point([glng, glat])

      // Top-level region containing the fix — exact polygon test.
      const top = topLevel.find((t) => {
        try {
          return turf.booleanPointInPolygon(pt, t.geom)
        } catch {
          return false
        }
      })
      // Fix outside the country, or in a hole between top regions → the
      // country aggregate is all we can honestly claim.
      if (!top) return { title: countryTitle, percent: entryFor(rootId).percent }

      // Descend root → … → the deepest place containing the fix. Stop when no
      // child's bbox contains the point — that node is the leaf underfoot.
      const chain = [rootId, top.id]
      let cur = top.id
      for (let guard = 0; guard < 64; guard++) {
        const kids = (children.get(cur) ?? []).filter((k) => {
          const kb = bboxCache.get(k)
          return (
            !!kb &&
            kb[0] <= glng &&
            kb[2] >= glng &&
            kb[1] <= glat &&
            kb[3] >= glat
          )
        })
        if (kids.length === 0) break
        // Several overlapping bboxes can contain a border point — take the
        // smallest (most specific) as the parent we keep descending through.
        kids.sort((a, b) => bboxArea(bboxCache.get(a)!) - bboxArea(bboxCache.get(b)!))
        cur = kids[0]
        chain.push(cur)
      }

      // Biggest fully-visible ancestor: scan root → leaf and keep the FIRST
      // whose whole footprint is inside the viewport. Zoomed out so the whole
      // country fits → the root wins and the bar reads the country roll-up;
      // zoomed in so only the sub-city fits → the sub-city wins.
      if (mapBounds) {
        for (const id of chain) {
          const bb = bboxCache.get(id)
          if (bb && bboxFullyVisible(bb, mapBounds)) {
            prevPick.current = null // GPS picks don't feed viewport hysteresis
            return {
              title: `${nameById.get(id) ?? "This area"} Explored`,
              percent: entryFor(id).percent,
            }
          }
        }
      }

      // Nothing on the chain is fully on screen (GPS on but the map panned
      // away, or the fix hugging the viewport edge) — stay on the deepest place
      // containing the fix rather than bouncing up to the country.
      const id = chain[chain.length - 1]
      return {
        title: `${nameById.get(id) ?? "This area"} Explored`,
        percent: entryFor(id).percent,
      }
    }

    // No viewport yet → whole-country aggregate.
    if (!mapBounds || !viewportCenter) {
      return { title: countryTitle, percent: entryFor(rootId).percent }
    }

    // Ancestor chain of the viewport center: root → deepest containing place.
    const path = [rootId]
    let guard = 0
    let cur = rootId
    while (guard++ < 64) {
      const inside = (children.get(cur) ?? []).filter((k) => {
        const bb = bboxCache.get(k)
        return (
          !!bb &&
          bb[0] <= viewportCenter.longitude &&
          bb[2] >= viewportCenter.longitude &&
          bb[1] <= viewportCenter.latitude &&
          bb[3] >= viewportCenter.latitude
        )
      })
      if (inside.length === 0) break
      inside.sort((a, b) => bboxArea(bboxCache.get(a)!) - bboxArea(bboxCache.get(b)!))
      cur = inside[0]
      path.push(cur)
    }

    // Hysteresis: keep the previously selected region while it is still an
    // ancestor of the viewport center (i.e. still on the path) and still at
    // least VISIBLE_KEEP on screen — a small pan across a boundary shouldn't
    // flip the label. The iso2 guard drops a stale pick from the previous
    // country for the render before the reset effect runs.
    const prev = prevPick.current
    const prevBB = prev ? bboxCache.get(prev.id) : null
    if (
      prev &&
      prev.iso2 === countryIso2 &&
      path.includes(prev.id) &&
      prevBB &&
      bboxVisibleFraction(prevBB, mapBounds) >= VISIBLE_KEEP
    ) {
      return { title: `${nameById.get(prev.id)} Explored`, percent: entryFor(prev.id).percent }
    }

    // Deepest ancestor whose footprint is at least VISIBLE_GAIN on screen.
    // Root → leaf, keeping the LAST match: a mostly-visible region (Addis Ababa
    // at ~90% with neighbor edges) beats both the fully-visible country and its
    // barely-visible districts.
    let picked: string | null = null
    for (const id of path) {
      const bb = bboxCache.get(id)
      if (bb && bboxVisibleFraction(bb, mapBounds) >= VISIBLE_GAIN) {
        picked = id
      }
    }

    if (picked) {
      prevPick.current = { id: picked, iso2: countryIso2 }
      return { title: `${nameById.get(picked)} Explored`, percent: entryFor(picked).percent }
    }

    // Nothing ≥ VISIBLE_GAIN → the label stops being a region pick; drop the
    // hysteresis baseline so the next region selection starts fresh.
    prevPick.current = null

    // Deep zoom into part of a region — nothing ≥ half visible. Aggregate the
    // visible leaves of ONLY the deepest center-ancestor's subtree, so the
    // number reflects a single region instead of mixing in neighboring ones.
    const region = path[path.length - 1]
    const regionName = nameById.get(region) ?? nameById.get(rootId) ?? "This area"

    const visibleLeaves = collectLeavesUnder(region, children).filter((id) => {
      const bb = bboxCache.get(id)
      return bb ? bboxIntersects(bb, mapBounds) : false
    })

    if (visibleLeaves.length === 0) {
      // Nothing measurable on screen — fall back to the region's own roll-up
      // rather than showing nothing.
      return { title: `${regionName} Explored`, percent: entryFor(region).percent }
    }

    const exploredCount = visibleLeaves.filter((id) => entryFor(id).explored).length
    return {
      title: `${regionName} · Visible Area`,
      percent: Math.round((exploredCount / visibleLeaves.length) * 100),
    }
  }, [countryIndex, mapBounds, viewportCenter, countryIso2, gpsLocation])
}
