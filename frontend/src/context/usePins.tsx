// context/usePins.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"
import type { Pin } from "@/types"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// ---------- Types ----------
type SecondaryPanel =
  | { type: "pinDetail"; pin: Pin }
  | { type: "preview"; placeName: string; address: string; lat: number; lng: number }
  | { type: "settings" }
  | { type: "addPin"; recentlyVisitedId?: string }
  | { type: "savedPlaces" }
  | null

type ListPanel =
  | { type: "categoryList"; categoryId: string }
  | { type: "saved" }
  | { type: "recentlyVisited" }
  | null

type PrefillLocation = {
  placeName: string
  address: string
  latitude: number
  longitude: number
  categoryId?: string
} | null

type FlyToTarget = { latitude: number; longitude: number } | null

type PinVisibility = "all" | "pinned" | "unpinned"

interface TemporaryPoi {
  id: string
  placeName: string
  address: string
  lat: number
  lng: number
  categoryName: string // Mapbox category name (e.g., "gym")
  countryCode?: string
}

interface PinsContextValue {
  // Existing
  pins: Pin[]
  loading: boolean
  loadPins: () => Promise<void>
  addPin: (pin: Omit<Pin, "id">) => Promise<Pin>
  updatePin: (id: string, updates: Partial<Pin>) => Promise<Pin>
  deletePin: (id: string) => Promise<void>
  secondaryPanel: SecondaryPanel
  setSecondaryPanel: (panel: SecondaryPanel) => void
  listPanel: ListPanel
  setListPanel: (panel: ListPanel) => void
  prefillLocation: PrefillLocation
  setPrefillLocation: (location: PrefillLocation) => void
  toggleSaved: (id: string) => Promise<void>
  flyToTarget: FlyToTarget
  setFlyToTarget: (target: FlyToTarget) => void
  highlightedPinId: string | null
  setHighlightedPinId: (id: string | null) => void

  // NEW filter properties – multi‑select + viewport aware
  activeCategoryIds: string[]
  toggleCategoryFilter: (categoryId: string) => void
  filteredPins: Pin[]
  temporaryPois: TemporaryPoi[]
  setTemporaryPois: (pois: TemporaryPoi[]) => void
  fetchNearbyPois: (mapboxCategories: string[], bounds: [number, number, number, number]) => Promise<void>
  clearFilter: () => void
  mapBounds: [number, number, number, number] | null
  setMapBounds: (bounds: [number, number, number, number] | null) => void

  // NEW visibility mode
  pinVisibility: PinVisibility
  setPinVisibility: (mode: PinVisibility) => void
}

const PinsContext = createContext<PinsContextValue | undefined>(undefined)

export function PinsProvider({ children }: { children: ReactNode }) {
  // ---- Existing state ----
  const [pins, setPins] = useState<Pin[]>([])
  const [loading, setLoading] = useState(true)
  const [secondaryPanel, setSecondaryPanel] = useState<SecondaryPanel>(null)
  const [listPanel, setListPanel] = useState<ListPanel>(null)
  const [prefillLocation, setPrefillLocation] = useState<PrefillLocation>(null)
  const [flyToTarget, setFlyToTarget] = useState<FlyToTarget>(null)
  const [highlightedPinId, setHighlightedPinId] = useState<string | null>(null)

  // ---- NEW filter state – multi‑select + viewport ----
  const [activeCategoryIds, setActiveCategoryIds] = useState<string[]>([])
  const [temporaryPois, setTemporaryPois] = useState<TemporaryPoi[]>([])
  const [mapBounds, setMapBounds] = useState<[number, number, number, number] | null>(null)

  // ---- NEW visibility mode ----
  const [pinVisibility, setPinVisibility] = useState<PinVisibility>("all")
  

  // ---- Helper: check if coordinate is inside bounds ----
  const isInBounds = useCallback(
    (lat: number, lng: number, bounds: [number, number, number, number] | null) => {
      if (!bounds) return true
      const [minLng, minLat, maxLng, maxLat] = bounds
      return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
    },
    []
  )

  // ---- Toggle category filter ----
  const toggleCategoryFilter = useCallback((categoryId: string) => {
    setActiveCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    )
  }, [])

  // ---- Clear all filters ----
  const clearFilter = useCallback(() => {
    setActiveCategoryIds([])
    setTemporaryPois([])
    // Optionally reset visibility to 'all' when clearing? I'll leave it as is.
  }, [])

  // ---- Derived filtered pins: OR‑match across selected categories + viewport ----
  const filteredPins = useMemo(() => {
    if (activeCategoryIds.length === 0) return pins
    return pins.filter(
      (pin) =>
        activeCategoryIds.includes(pin.categoryId) &&
        isInBounds(pin.latitude, pin.longitude, mapBounds)
    )
  }, [pins, activeCategoryIds, mapBounds, isInBounds])

  // ---- Load pins ----
  async function loadPins() {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/pins`, { credentials: "include" })
      const data = await response.json()
      setPins(data.pins)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPins()
  }, [])

  // ---- CRUD ----
  async function addPin(newPin: Omit<Pin, "id">): Promise<Pin> {
    const response = await fetch(`${API_BASE}/pins`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPin),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? "Failed to create pin")
    setPins((prev) => [...prev, data.pin])
    // Remove from temporary POIs if it was one
    setTemporaryPois((prev) => prev.filter((p) => p.id !== data.pin.id))
    return data.pin
  }

  async function updatePin(id: string, updates: Partial<Pin>): Promise<Pin> {
    const response = await fetch(`${API_BASE}/pins/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? "Failed to update pin")
    setPins((prev) => prev.map((p) => (p.id === id ? data.pin : p)))
    return data.pin
  }

  async function deletePin(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/pins/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error ?? "Failed to delete pin")
    }
    setPins((prev) => prev.filter((p) => p.id !== id))
  }

  async function toggleSaved(id: string) {
    const pin = pins.find((p) => p.id === id)
    if (!pin) return
    const response = await fetch(`${API_BASE}/pins/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved: !pin.saved }),
    })
    if (!response.ok) return
    const data = await response.json()
    setPins((prev) => prev.map((p) => (p.id === id ? data.pin : p)))
  }

  // ---- Helper ----
  function extractCountryCode(feature: any): string | undefined {
    // Search Box Category API returns context differently
    return feature.properties?.context?.country?.country_code?.toUpperCase()
  }

  // ---- NEW: fetch nearby POIs using Mapbox Search Box Category API ----
  const fetchNearbyPois = useCallback(
    async (mapboxCategories: string[], bounds: [number, number, number, number]) => {
      if (!MAPBOX_TOKEN || mapboxCategories.length === 0) {
        setTemporaryPois([])
        return
      }
      const [minLng, minLat, maxLng, maxLat] = bounds
      const bbox = `${minLng},${minLat},${maxLng},${maxLat}`

      try {
        const results = await Promise.all(
          mapboxCategories.map(async (category) => {
            const url = `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(category)}?access_token=${MAPBOX_TOKEN}&bbox=${bbox}&limit=25`
            const response = await fetch(url)
            if (!response.ok) return []
            const data = await response.json()
            return (data.features ?? []).map((f: any) => ({
              id: f.properties.mapbox_id || f.id,
              placeName: f.properties.name || "Unnamed",
              address: f.properties.full_address ?? f.properties.place_formatted ?? f.properties.name,
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
              categoryName: category,
              countryCode: extractCountryCode(f),
            }))
          })
        )

        const savedPlaceIds = new Set(pins.map((p) => p.placeId))
        const allPois = results.flat()
        const uniquePois = allPois.filter((poi) => !savedPlaceIds.has(poi.id))
        setTemporaryPois(uniquePois)
console.log("temporaryPois:", results.flat())
      } catch (error) {
        console.error("Error fetching POIs:", error)
      }
    },
    [pins]
  )

  // ---- Context value ----
  const value: PinsContextValue = {
    pins,
    loading,
    loadPins,
    addPin,
    updatePin,
    deletePin,
    secondaryPanel,
    setSecondaryPanel,
    listPanel,
    setListPanel,
    prefillLocation,
    setPrefillLocation,
    toggleSaved,
    flyToTarget,
    setFlyToTarget,
    highlightedPinId,
    setHighlightedPinId,
    // NEW
    activeCategoryIds,
    toggleCategoryFilter,
    filteredPins,
    temporaryPois,
    setTemporaryPois,
    fetchNearbyPois,
    clearFilter,
    mapBounds,
    setMapBounds,
    pinVisibility,
    setPinVisibility,
  }

  return <PinsContext.Provider value={value}>{children}</PinsContext.Provider>
}

export function usePins() {
  const context = useContext(PinsContext)
  if (!context) {
    throw new Error("usePins must be used within a PinsProvider")
  }
  return context
}
