// context/usePins.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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
  | { type: "addComment" }
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

// Phase 2: the map viewport center, updated on pan/zoom. Feeds the top-comment
// widget's "nearest location" query.
type ViewportCenter = { latitude: number; longitude: number } | null

type PinVisibility = "all" | "pinned" | "unpinned"

// ---- TemporaryPoi now includes categoryId (real app ID) ----
interface TemporaryPoi {
  id: string
  placeName: string
  address: string
  lat: number
  lng: number
  categoryId: string       // NEW — your app's category id
  categoryName: string     // Mapbox category string, kept for display
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
  isManagingSaved: boolean
  setIsManagingSaved: (open: boolean) => void
  flyToTarget: FlyToTarget
  setFlyToTarget: (target: FlyToTarget) => void
  highlightedPinId: string | null
  setHighlightedPinId: (id: string | null) => void

  // Single-sidebar-open coordination: the filter panel and the comment view are
  // overlay sidebars tracked outside `secondaryPanel`; these coordinate all
  // three so only one is open at a time.
  filterPanelOpen: boolean
  openFilterPanel: (open: boolean) => void
  commentViewOpen: boolean
  openCommentView: (open: boolean) => void

  // Filter & viewport
  activeCategoryIds: string[]
  toggleCategoryFilter: (categoryId: string) => void
  temporaryPois: TemporaryPoi[]
  setTemporaryPois: (pois: TemporaryPoi[]) => void  // NEW signature: accepts array of { id, mapboxCategory }
  fetchNearbyPois: (
    categories: { id: string; mapboxCategory: string }[],
    bounds: [number, number, number, number]
  ) => Promise<void>
  clearFilter: () => void
  mapBounds: [number, number, number, number] | null
  setMapBounds: (bounds: [number, number, number, number] | null) => void
  pinVisibility: PinVisibility
  setPinVisibility: (mode: PinVisibility) => void
  // Phase 2: viewport center for the top-comment widget
  viewportCenter: ViewportCenter
  setViewportCenter: (center: ViewportCenter) => void
}

const PinsContext = createContext<PinsContextValue | undefined>(undefined)

export function PinsProvider({ children }: { children: ReactNode }) {
  // ---- Existing state ----
  const [pins, setPins] = useState<Pin[]>([])
  const [loading, setLoading] = useState(true)
  const [secondaryPanel, _setSecondaryPanel] = useState<SecondaryPanel>(null)
  const [listPanel, setListPanel] = useState<ListPanel>(null)
  const [prefillLocation, setPrefillLocation] = useState<PrefillLocation>(null)
  const [isManagingSaved, setIsManagingSaved] = useState(false)
  const [flyToTarget, setFlyToTarget] = useState<FlyToTarget>(null)
  const [highlightedPinId, setHighlightedPinId] = useState<string | null>(null)

  // ---- Overlay sidebars tracked outside `secondaryPanel`, coordinated below
  // so only one overlay sidebar is open at a time. ----
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [commentViewOpen, setCommentViewOpen] = useState(false)

  // Public setter for the secondary (right-side) panel. Opening a panel closes
  // the filter panel and the comment view; closing one never reopens another.
  const setSecondaryPanel = useCallback((panel: SecondaryPanel) => {
    _setSecondaryPanel(panel)
    if (panel) {
      setFilterPanelOpen(false)
      setCommentViewOpen(false)
    }
  }, [])

  // Opening the filter panel closes the secondary panel and comment view.
  const openFilterPanel = useCallback((open: boolean) => {
    setFilterPanelOpen(open)
    if (open) {
      _setSecondaryPanel(null)
      setCommentViewOpen(false)
    }
  }, [])

  // Opening the comment view closes the secondary panel and filter panel.
  const openCommentView = useCallback((open: boolean) => {
    setCommentViewOpen(open)
    if (open) {
      _setSecondaryPanel(null)
      setFilterPanelOpen(false)
    }
  }, [])

  // ---- Filter state ----
  const [activeCategoryIds, setActiveCategoryIds] = useState<string[]>([])
  const [temporaryPois, setTemporaryPois] = useState<TemporaryPoi[]>([])
  const [mapBounds, setMapBounds] = useState<[number, number, number, number] | null>(null)
  const [pinVisibility, setPinVisibility] = useState<PinVisibility>("all")
  const [viewportCenter, setViewportCenter] = useState<ViewportCenter>(null)

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
  }, [])

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
    return feature.properties?.context?.country?.country_code?.toUpperCase()
  }

  // ---- NEW fetchNearbyPois with categoryId ----
  const fetchNearbyPois = useCallback(
  async (
    categories: { id: string; mapboxCategory: string }[],
    bounds: [number, number, number, number]
  ) => {
    if (!MAPBOX_TOKEN || categories.length === 0) {
      setTemporaryPois([])
      return
    }
    const [minLng, minLat, maxLng, maxLat] = bounds
    const bbox = `${minLng},${minLat},${maxLng},${maxLat}`

    try {
      const results = await Promise.all(
        categories.map(async ({ id, mapboxCategory }) => {
          const url = `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(mapboxCategory)}?access_token=${MAPBOX_TOKEN}&bbox=${bbox}&limit=25`
          const response = await fetch(url)

          if (!response.ok) {
            const body = await response.text()
            console.error(`Category fetch failed [${response.status}] for "${mapboxCategory}":`, body)
            return []
          }

          const data = await response.json()
          console.log(`"${mapboxCategory}" → ${data.features?.length ?? 0} results, bbox=${bbox}`)

          return (data.features ?? []).map((f: any) => ({
            id: f.properties.mapbox_id || f.id,
            placeName: f.properties.name || "Unnamed",
            address: f.properties.full_address ?? f.properties.place_formatted ?? f.properties.name,
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            categoryId: id,
            categoryName: mapboxCategory,
            countryCode: extractCountryCode(f),
          }))
        })
      )

      const savedPlaceIds = new Set(pins.map((p) => p.placeId))
      const uniquePois = results.flat().filter((poi) => !savedPlaceIds.has(poi.id))
      setTemporaryPois(uniquePois)
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
    isManagingSaved,
    setIsManagingSaved,
    flyToTarget,
    setFlyToTarget,
    highlightedPinId,
    setHighlightedPinId,
    // Single-sidebar-open coordination
    filterPanelOpen,
    openFilterPanel,
    commentViewOpen,
    openCommentView,
    // Filter
    activeCategoryIds,
    toggleCategoryFilter,
    temporaryPois,
    setTemporaryPois,
    fetchNearbyPois,
    clearFilter,
    mapBounds,
    setMapBounds,
    pinVisibility,
    setPinVisibility,
    viewportCenter,
    setViewportCenter,
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
