// components/maps/PublicPinsLayer.tsx
// The "Friends' pins" overlay — public pins owned by the viewer's connections
// and followed travelers (server GET /pins/public, the same audience feed a
// profile gallery uses). Markers are READ-ONLY: tapping one opens a popup with
// the owner (→ their public profile) and a Comments button that opens the
// threaded comment section for that public pin (the feed only returns content
// the viewer may comment on). Public route pairs (two public pins of the same
// visible owner linked by a comment thread) draw as dashed lines between the
// endpoint markers.
//
// The layer stays mounted while hidden so the map's toggle can show the pin
// count; it renders nothing until `visible`. Guests have no social graph, so
// their feed is always empty and nothing renders.
//
// The feed (pins + routePairs) is owned by MapView, which runs the single
// /pins/public poll and resolves ?pin= deep-links; the layer stays presentational.
import { useMemo, useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Marker, Popup, Source, Layer } from "react-map-gl/mapbox"
import { MessageSquare, Globe2, User } from "lucide-react"
import { MIN_ZOOM_TO_SHOW_PINS } from "@/components/pins/PinMarker"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { PublicPin } from "@/types/community"

// A stable per-owner hue so one traveler's pins read as one cluster on the map.
const OWNER_COLORS = [
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#F59E0B", // amber
  "#06B6D4", // cyan
  "#84CC16", // lime
  "#F97316", // orange
]
function colorFor(userId: string): string {
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0
  return OWNER_COLORS[Math.abs(h) % OWNER_COLORS.length]
}

const initials = (first: string, last: string) =>
  `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?"

export default function PublicPinsLayer({
  visible = false,
  zoom = 0,
  onCountChange,
  onOpenComments,
  pins,
  routePairs,
}: {
  visible?: boolean
  zoom?: number
  onCountChange?: (count: number) => void
  onOpenComments?: (pin: PublicPin) => void
  pins: PublicPin[]
  routePairs: { startPinId: string; endPinId: string }[]
}) {
  const [selected, setSelected] = useState<PublicPin | null>(null)

  const pinById = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins])

  // Report the public-pin count (even while hidden) so the map's toggle can
  // show a badge and only surface when there's something to see.
  useEffect(() => {
    onCountChange?.(pins.length)
  }, [pins.length, onCountChange])

  if (!visible) return null

  const visiblePins =
    zoom >= MIN_ZOOM_TO_SHOW_PINS ? pins : selected ? [selected] : []

  return (
    <>
      {visiblePins.map((pin) => {
        const color = colorFor(pin.owner.userId)
        const isSel = selected?.id === pin.id
        return (
          <Marker
            key={pin.id}
            longitude={pin.longitude}
            latitude={pin.latitude}
            anchor="center"
            onClick={(e) => {
              e.originalEvent?.stopPropagation?.()
              setSelected(isSel ? null : pin)
            }}
          >
            <button
              type="button"
              aria-label={`${pin.customName || pin.name} — public pin by ${pin.owner.firstName} ${pin.owner.lastName}`}
              title={pin.customName || pin.name}
              className={`relative flex h-7 w-7 items-center justify-center rounded-full text-white shadow-lg ring-2 transition-transform hover:scale-110 ${
                isSel ? "scale-125" : ""
              }`}
              style={{ backgroundColor: color }}
            >
              <Avatar className="h-full w-full rounded-full">
                <AvatarImage
                  src={pin.owner.profileImage || undefined}
                  alt={`${pin.owner.firstName} ${pin.owner.lastName}`}
                />
                <AvatarFallback className="bg-transparent text-[10px] font-bold text-white">
                  {initials(pin.owner.firstName, pin.owner.lastName)}
                </AvatarFallback>
              </Avatar>
              {/* small green public dot so read-only markers read as shared, not own */}
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background"
                style={{ backgroundColor: "#00B47B" }}
              >
                <Globe2 className="h-1.5 w-1.5 text-white" />
              </span>
            </button>
          </Marker>
        )
      })}

      {zoom >= MIN_ZOOM_TO_SHOW_PINS && routePairs.length > 0 && (
        <PublicRouteLines routePairs={routePairs} pinById={pinById} />
      )}

      {selected && (
        <Popup
          longitude={selected.longitude}
          latitude={selected.latitude}
          anchor="top"
          offset={18}
          closeButton
          onClose={() => setSelected(null)}
          maxWidth="18rem"
        >
          <div className="space-y-2.5">
            <Link
              to={`/users/${selected.owner.userId}`}
              onClick={() => setSelected(null)}
              className="flex items-center gap-2.5 rounded-lg px-1 py-0.5 transition-colors hover:bg-muted"
            >
              <Avatar className="h-8 w-8 rounded-full">
                <AvatarImage
                  src={selected.owner.profileImage || undefined}
                  alt={selected.owner.firstName}
                />
                <AvatarFallback>
                  {initials(selected.owner.firstName, selected.owner.lastName)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight">
                  {selected.owner.firstName} {selected.owner.lastName}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  @{selected.owner.username}
                </span>
              </span>
            </Link>

            <p className="px-1 text-sm font-medium leading-snug">
              {selected.customName || selected.name}
            </p>

            <div className="flex items-center gap-2">
              <Link
                to={`/users/${selected.owner.userId}`}
                onClick={() => setSelected(null)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/60 px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <User className="h-3.5 w-3.5" />
                View profile
              </Link>
              <button
                type="button"
                onClick={() => {
                  const pin = selected
                  setSelected(null)
                  onOpenComments?.(pin)
                }}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Comments
              </button>
            </div>
          </div>
        </Popup>
      )}
    </>
  )
}

// Dashed line for every public route pair whose two endpoints are both in the
// visible feed (a pair can dangle if the owner made an endpoint private between
// the feed query and now — drop those). A route here is just a comment thread
// between two pins, so a straight join is the honest geometry.
function PublicRouteLines({
  routePairs,
  pinById,
}: {
  routePairs: { startPinId: string; endPinId: string }[]
  pinById: Map<string, PublicPin>
}) {
  const geojson = useMemo<GeoJSON.FeatureCollection | null>(() => {
    const features = routePairs.flatMap(({ startPinId, endPinId }) => {
      const start = pinById.get(startPinId)
      const end = pinById.get(endPinId)
      if (!start || !end || startPinId === endPinId) return []
      return [
        {
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [start.longitude, start.latitude],
              [end.longitude, end.latitude],
            ],
          },
          properties: { startPinId, endPinId },
        },
      ]
    })
    return features.length
      ? ({ type: "FeatureCollection", features } as GeoJSON.FeatureCollection)
      : null
  }, [routePairs, pinById])

  if (!geojson) return null
  return (
    <Source id="public-routes" type="geojson" data={geojson}>
      <Layer
        id="public-routes-line"
        type="line"
        paint={{
          "line-color": "#8B5CF6",
          "line-width": 3,
          "line-dasharray": [2, 2],
          "line-opacity": 0.85,
        }}
      />
    </Source>
  )
}
