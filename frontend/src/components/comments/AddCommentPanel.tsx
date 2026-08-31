// components/comments/AddCommentPanel.tsx
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  X,
  MapPin,
  MessageSquarePlus,
  Search,
  Lock,
  Route as RouteIcon,
  CornerDownRight,
} from "lucide-react"
import type { Pin } from "@/types"
import { usePins } from "@/context/usePins"
import { useAuth } from "@/context/AuthContext"
import { usePlaceLookup } from "@/hooks/usePlaceLookup"
import { useLocationSearch } from "@/hooks/useLocationSearch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import SidePanel from "@/components/layout/sidebar/SidePanel"
import LocationSearchField from "@/components/pins/LocationSearchField"
import LocationPreview from "@/components/pins/LocationPreview"
import CommentSection from "@/components/comments/CommentSection"

type Mode = "pin" | "location" | "route"

const AddCommentPanel = () => {
  const { secondaryPanel, setSecondaryPanel, pins } = usePins()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { findPlaceAt } = usePlaceLookup()
  const search = useLocationSearch(null)

  const isOpen = secondaryPanel?.type === "addComment"

  const [mode, setMode] = useState<Mode>("pin")
  const [pinQuery, setPinQuery] = useState("")
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null)
  const [startPin, setStartPin] = useState<Pin | null>(null)
  const [endPin, setEndPin] = useState<Pin | null>(null)
  const [resetKey, setResetKey] = useState(0)

  // Reset picker state whenever the panel opens fresh.
  useEffect(() => {
    if (isOpen) {
      setMode("pin")
      setPinQuery("")
      setSelectedPin(null)
      setStartPin(null)
      setEndPin(null)
      search.reset()
      setResetKey((k) => k + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // All hooks must run on every render — never after an early return. So the
  // memos below are computed unconditionally (they just return null when there
  // is nothing to resolve) and the panel only early-returns for rendering.
  // ---- Location mode: resolve the DB place for the searched point ----
  const placeCheck = useMemo(() => {
    if (!search.location) return null
    return findPlaceAt(search.location.latitude, search.location.longitude)
  }, [search.location, findPlaceAt])
  const locationBlocked = Boolean(search.location) && !placeCheck?.isUnlocked

  // ---- Resolve the current target from the active mode ----
  const target = useMemo(() => {
    if (mode === "pin" && selectedPin) {
      return {
        type: "pin" as const,
        pinId: selectedPin.id,
        latitude: selectedPin.latitude,
        longitude: selectedPin.longitude,
      }
    }
    if (mode === "location" && search.location && placeCheck?.isUnlocked && placeCheck.placeId) {
      return {
        type: "location" as const,
        placeId: placeCheck.placeId,
        latitude: search.location.latitude,
        longitude: search.location.longitude,
      }
    }
    if (mode === "route" && startPin && endPin) {
      return {
        type: "route" as const,
        routeStartPinId: startPin.id,
        routeEndPinId: endPin.id,
      }
    }
    return null
  }, [mode, selectedPin, search.location, placeCheck, startPin, endPin])

  if (!isOpen) return null

  // ---- Pin search ----
  const filteredPins = pinQuery.trim()
    ? pins.filter((p) =>
        p.name.toLowerCase().includes(pinQuery.toLowerCase())
      )
    : pins

  const targetLabel = target
    ? target.type === "pin"
      ? selectedPin!.name
      : target.type === "location"
        ? search.location!.placeName
        : `Route: ${startPin!.name} → ${endPin!.name}`
    : null

  const modeButton = (m: Mode, label: string) => (
    <button
      key={m}
      onClick={() => setMode(m)}
      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
        mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  )

  return (
    <SidePanel
      widthClassName="w-96"
      onOpenChange={(open) => {
        if (!open) setSecondaryPanel(null)
      }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
              <MessageSquarePlus className="h-4 w-4" />
            </div>
            <span className="font-heading text-lg font-semibold tracking-tight">Add Comment</span>
          </div>
          <button
            onClick={() => setSecondaryPanel(null)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a pin, location, or route to discuss.
        </p>
      </div>

      <div className="px-3 py-4 space-y-3">
        {/* Mode tabs */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          {modeButton("pin", "Pin")}
          {modeButton("location", "Location")}
          {modeButton("route", "Route")}
        </div>

        {/* Pin mode */}
        {mode === "pin" && (
          <div className="rounded-xl border bg-card/50 p-3 space-y-2">
            <div className="flex items-center gap-2 px-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Your Pins</h3>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search pins..."
                value={pinQuery}
                onChange={(e) => setPinQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-background/50 border-muted"
              />
            </div>
            {pins.length === 0 ? (
              <p className="text-sm text-muted-foreground px-3 py-2 text-center">
                You don't have any pins yet.{" "}
                <button
                  className="text-primary hover:underline"
                  onClick={() => {
                    setSecondaryPanel(null)
                    setTimeout(() => setSecondaryPanel({ type: "addPin" }), 50)
                  }}
                >
                  Add one first
                </button>
              </p>
            ) : filteredPins.length === 0 ? (
              <p className="text-sm text-muted-foreground px-3 py-2 text-center">No matching pins.</p>
            ) : (
              <div className="space-y-0.5 max-h-52 overflow-y-auto">
                {filteredPins.map((pin) => (
                  <button
                    key={pin.id}
                    onClick={() => setSelectedPin(selectedPin?.id === pin.id ? null : pin)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all hover:bg-muted/50 ${
                      selectedPin?.id === pin.id ? "bg-primary/10 text-primary" : "text-foreground"
                    }`}
                  >
                    <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-left">{pin.name}</span>
                    {selectedPin?.id === pin.id && <CornerDownRight className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Location mode */}
        {mode === "location" && (
          <div className="rounded-xl border bg-card/50 p-3 space-y-2">
            <div className="flex items-center gap-2 px-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Find a Location</h3>
            </div>
            <LocationSearchField
              containerRef={search.containerRef}
              searchQuery={search.searchQuery}
              suggestions={search.suggestions}
              showSuggestions={search.showSuggestions}
              onInputChange={search.onInputChange}
              onInputKeyDown={search.onInputKeyDown}
              onSelect={search.selectSuggestion}
              onFocus={() =>
                search.suggestions.length > 0 && search.setShowSuggestions(true)
              }
            />
            <LocationPreview location={search.location} />
            {locationBlocked && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Comments are for unlocked places. Visit it in person to unlock it first.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Route mode */}
        {mode === "route" && (
          <div className="rounded-xl border bg-card/50 p-3 space-y-3">
            <div className="flex items-center gap-2 px-1 text-muted-foreground">
              <RouteIcon className="h-3.5 w-3.5" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Route (Start → End)</h3>
            </div>
            {pins.length === 0 ? (
              <p className="text-sm text-muted-foreground px-3 py-2 text-center">
                You need at least two pins to comment on a route.
              </p>
            ) : (
              <>
                <PinSelect label="Start" value={startPin} onChange={setStartPin} pins={pins} excludeId={endPin?.id} />
                <PinSelect label="End" value={endPin} onChange={setEndPin} pins={pins} excludeId={startPin?.id} />
              </>
            )}
          </div>
        )}

        {/* Comment area once a target is chosen */}
        {target ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
              <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="text-xs text-muted-foreground truncate">
                Commenting on <span className="font-medium text-foreground">{targetLabel}</span>
              </span>
            </div>

            {user ? (
              <CommentSection key={`${resetKey}-${target.type}`} target={target} />
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-5 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Log in to post or vote on comments.
                </p>
                <Button size="sm" onClick={() => navigate("/login")}>
                  Log in to comment
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center px-2">
            {mode === "pin"
              ? "Select a pin above to start commenting."
              : mode === "location"
                ? "Search and select an unlocked location above."
                : "Choose a start and end pin above."}
          </p>
        )}
      </div>
    </SidePanel>
  )
}

function PinSelect({
  label,
  value,
  onChange,
  pins,
  excludeId,
}: {
  label: string
  value: Pin | null
  onChange: (pin: Pin | null) => void
  pins: Pin[]
  excludeId?: string
}) {
  const available = pins.filter((p) => p.id !== excludeId)
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {available.map((pin) => (
          <button
            key={pin.id}
            onClick={() => onChange(value?.id === pin.id ? null : pin)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              value?.id === pin.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            {pin.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default AddCommentPanel
