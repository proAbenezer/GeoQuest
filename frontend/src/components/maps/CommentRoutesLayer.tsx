// components/maps/CommentRoutesLayer.tsx
// Map overlay for route conversations: a brand-green path (real road geometry
// from Mapbox Directions) between each route's start and end pin, plus a count
// badge sitting ON the path at its midpoint. Clicking the line (a canvas layer
// — handled via queryRenderedFeatures in MapView's handleMapClick) or the badge
// (an HTML marker onClick) opens the route-comment panel.
//
// Visibility mirrors the pins: the overlay hides below MIN_ZOOM_TO_SHOW_PINS,
// but an activated route (its comments panel is open) stays visible below that
// threshold — exactly like a highlighted pin does. `visible` is the master
// switch for the whole overlay; `onCountChange` reports the total route count
// so the map toggle can show a badge and only surface when there's something
// to show.
import { useEffect, useMemo, useState } from "react"
import { Source, Layer, Marker } from "react-map-gl/mapbox"
import type { CommentRoute } from "@/types/place"
import { fetchCommentRoutes } from "@/lib/api"
import { usePins } from "@/context/usePins"
import { MIN_ZOOM_TO_SHOW_PINS } from "@/components/pins/PinMarker"

const BRAND_COLOR = "#00B47B"
// Same orange the pins turn when highlighted — the selected route reuses it so
// "selected" reads identically on both pins and routes.
const ACTIVE_COLOR = "#D97B29"
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const routeKey = (startPinId: string, endPinId: string) => `${startPinId}:${endPinId}`

// Straight-line fallback geometry, used only when Directions can't produce a
// path for a route (e.g. the two endpoints aren't road-connected).
function straightLine(r: CommentRoute): GeoJSON.LineString {
  return {
    type: "LineString",
    coordinates: [
      [r.startLng, r.startLat],
      [r.endLng, r.endLat],
    ],
  }
}

// Coordinate halfway along a LineString (by cumulative segment length), so the
// count badge sits on the actual path rather than the straight-line midpoint.
function midCoordinate(coords: [number, number][]): [number, number] {
  if (coords.length === 0) return [0, 0]
  if (coords.length === 1) return coords[0]
  const segLengths: number[] = []
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const len = Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1])
    segLengths.push(len)
    total += len
  }
  if (total === 0) return coords[0]
  let target = total / 2
  for (let i = 0; i < segLengths.length; i++) {
    if (target <= segLengths[i]) {
      const t = target / segLengths[i]
      return [
        coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t,
        coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t,
      ]
    }
    target -= segLengths[i]
  }
  return coords[coords.length - 1]
}

export default function CommentRoutesLayer({
  visible = true,
  zoom = 0,
  onCountChange,
}: {
  visible?: boolean
  zoom?: number
  onCountChange?: (count: number) => void
}) {
  const {
    setSecondaryPanel,
    setHighlightedPinId,
    selectedRoute,
    setSelectedRoute,
    openCommentView,
  } = usePins()
  const [routes, setRoutes] = useState<CommentRoute[]>([])
  const [geoms, setGeoms] = useState<Record<string, GeoJSON.LineString>>({})

  // Load the route list once — also feeds the map toggle's count badge.
  useEffect(() => {
    let cancelled = false
    fetchCommentRoutes()
      .then((data) => {
        if (cancelled) return
        setRoutes(data)
        onCountChange?.(data.length)
      })
      .catch((err) => console.error("Failed to load comment routes:", err))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resolve each route to a real driving path via Mapbox Directions, cached per
  // route so toggling the overlay off/on (or re-rendering) is instant. Skips
  // routes already resolved; failures just fall back to a straight line.
  useEffect(() => {
    if (!visible || !MAPBOX_TOKEN) return
    const missing = routes.filter((r) => !geoms[routeKey(r.routeStartPinId, r.routeEndPinId)])
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      const results = await Promise.all(
        missing.map(async (r) => {
          try {
            const url =
              `https://api.mapbox.com/directions/v5/mapbox/driving/` +
              `${r.startLng},${r.startLat};${r.endLng},${r.endLat}` +
              `?geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_TOKEN}`
            const res = await fetch(url)
            if (!res.ok) return null
            const data = await res.json()
            const geom = data.routes?.[0]?.geometry
            return geom?.type === "LineString"
              ? { key: routeKey(r.routeStartPinId, r.routeEndPinId), geom }
              : null
          } catch {
            return null
          }
        })
      )
      if (cancelled) return
      const resolved = results.filter(Boolean) as {
        key: string
        geom: GeoJSON.LineString
      }[]
      if (resolved.length > 0) {
        setGeoms((prev) => {
          const next = { ...prev }
          let changed = false
          for (const { key, geom } of resolved) {
            if (!next[key]) {
              next[key] = geom
              changed = true
            }
          }
          return changed ? next : prev
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visible, routes, geoms])

  const activeRouteKey = selectedRoute
    ? routeKey(selectedRoute.routeStartPinId, selectedRoute.routeEndPinId)
    : null

  // Which routes render now: every route above the pin zoom threshold, plus an
  // activated route below it (mirrors the highlighted-pin behavior).
  const visibleRoutes = useMemo(
    () =>
      routes.filter(
        (r) =>
          visible &&
          (zoom >= MIN_ZOOM_TO_SHOW_PINS ||
            activeRouteKey === routeKey(r.routeStartPinId, r.routeEndPinId))
      ),
    [routes, visible, zoom, activeRouteKey]
  )

  const geojson = useMemo<GeoJSON.FeatureCollection | null>(() => {
    const features = visibleRoutes.map((r) => {
      const key = routeKey(r.routeStartPinId, r.routeEndPinId)
      const geom = geoms[key] ?? straightLine(r)
      return {
        type: "Feature" as const,
        geometry: geom,
        properties: {
          routeStartPinId: r.routeStartPinId,
          routeEndPinId: r.routeEndPinId,
          // Drives the selected styling: an active route renders solid orange
          // (mirroring how a highlighted pin turns orange) instead of the
          // default dashed green.
          active: activeRouteKey === key,
        },
      }
    })
    return features.length
      ? ({ type: "FeatureCollection", features } as GeoJSON.FeatureCollection)
      : null
  }, [visibleRoutes, geoms, activeRouteKey])

  const openRouteComments = (startPinId: string, endPinId: string) => {
    // Selecting a route: deselect any highlighted pin and close any open panels
    // — route selection drives the bottom-right comment widget (no side panel),
    // so the map stays unobstructed.
    setHighlightedPinId(null)
    openCommentView(false)
    setSecondaryPanel(null)
    setSelectedRoute({ routeStartPinId: startPinId, routeEndPinId: endPinId })
  }

  if (!geojson) return null

  return (
    <>
      <Source id="comment-routes" type="geojson" data={geojson}>
        {/* Light casing behind the path so it stands out against the dark
            basemap; also gets picked up by the map's click handler. The
            selected route gets a brighter, soft-glowing casing. */}
        <Layer
          id="comment-routes-casing"
          type="line"
          paint={{
            "line-color": "#ffffff",
            "line-width": ["case", ["get", "active"], 11, 9],
            "line-dasharray": [2, 2],
            // Active casing kept faint (low opacity, barely any blur) so it
            // can't wash out the selected route's orange to a pale peach at low
            // zoom — a solid saturated #D97B29 line + dashed-green contrast is
            // already enough to mark selection. The default casing stays as-is.
            "line-opacity": ["case", ["get", "active"], 0.4, 0.3],
            "line-blur": ["case", ["get", "active"], 0.25, 0],
          }}
        />
        <Layer
          id="comment-routes-line"
          type="line"
          paint={{
            "line-color": ["case", ["get", "active"], ACTIVE_COLOR, BRAND_COLOR],
            "line-width": ["case", ["get", "active"], 8, 6],
            // Solid when selected, dashed otherwise — makes the active route
            // unmistakable even at a glance.
            "line-dasharray": ["case", ["get", "active"], [1, 0], [2, 2]],
            "line-opacity": 1,
          }}
        />
      </Source>
      {visibleRoutes.map((r) => {
        const key = routeKey(r.routeStartPinId, r.routeEndPinId)
        const geom = geoms[key]
        const isActive = activeRouteKey === key
        const mid = geom
          ? midCoordinate(geom.coordinates as [number, number][])
          : [(r.startLng + r.endLng) / 2, (r.startLat + r.endLat) / 2]
        return (
          <Marker
            key={key}
            longitude={mid[0]}
            latitude={mid[1]}
            anchor="center"
            onClick={(e) => {
              e.originalEvent?.stopPropagation?.()
              openRouteComments(r.routeStartPinId, r.routeEndPinId)
            }}
          >
            <button
              type="button"
              className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold leading-none text-white ring-2 ring-background shadow-md transition-transform hover:scale-110 ${
                isActive ? "scale-110 bg-[#D97B29]" : "bg-[#00B47B]"
              }`}
              aria-label={`${r.count} comment${r.count === 1 ? "" : "s"} on route ${r.startName} → ${r.endName}`}
              title={`${r.startName} → ${r.endName}`}
            >
              {r.count > 9 ? "9+" : r.count}
            </button>
          </Marker>
        )
      })}
    </>
  )
}
