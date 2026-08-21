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
  categoryId?: string  // now we expect categoryId
} | null

type FlyToTarget = { latitude: number; longitude: number } | null

interface TemporaryPoi {
  id: string
  placeName: string
  address: string
  lat: number
  lng: number
  categoryName: string  // store the category name for later mapping
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

  // NEW filter properties – using category ID
  activeCategoryId: string | null
  setActiveCategoryId: (categoryId: string | null) => void
  filteredPins: Pin[]
  temporaryPois: TemporaryPoi[]
  setTemporaryPois: (pois: TemporaryPoi[]) => void
  fetchNearbyPois: (categoryName: string, bounds: [number, number, number, number]) => Promise<void>
  clearFilter: () => void
  mapBounds: [number, number, number, number] | null
  setMapBounds: (bounds: [number, number, number, number] | null) => void
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

  // ---- NEW filter state – now using category ID ----
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [temporaryPois, setTemporaryPois] = useState<TemporaryPoi[]>([])
  const [mapBounds, setMapBounds] = useState<[number, number, number, number] | null>(null)

  // ---- Derived filtered pins (by categoryId) ----
  const filteredPins = useMemo(() => {
    if (!activeCategoryId) return pins
    return pins.filter(pin => pin.categoryId === activeCategoryId)
  }, [pins, activeCategoryId])

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
    setPins(prev => [...prev, data.pin])
    // Remove from temporary POIs if it was one
    setTemporaryPois(prev => prev.filter(p => p.id !== data.pin.id))
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
    setPins(prev => prev.map(p => (p.id === id ? data.pin : p)))
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
    setPins(prev => prev.filter(p => p.id !== id))
  }

  async function toggleSaved(id: string) {
    const pin = pins.find(p => p.id === id)
    if (!pin) return
    const response = await fetch(`${API_BASE}/pins/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved: !pin.saved }),
    })
    if (!response.ok) return
    const data = await response.json()
    setPins(prev => prev.map(p => (p.id === id ? data.pin : p)))
  }

  // ---- Helper ----
  function extractCountryCode(feature: any): string | undefined {
    if (feature.place_type?.includes("country") && feature.properties?.short_code) {
      return feature.properties.short_code.toUpperCase()
    }
    const countryContext = feature.context?.find((c: any) => c.id?.startsWith("country"))
    return countryContext?.short_code?.toUpperCase()
  }

  // ---- NEW: fetch nearby POIs using category name ----
  const fetchNearbyPois = useCallback(async (categoryName: string, bounds: [number, number, number, number]) => {
    if (!MAPBOX_TOKEN) {
      console.error("Mapbox token missing")
      return
    }
    const [minLng, minLat, maxLng, maxLat] = bounds
    const bbox = `${minLng},${minLat},${maxLng},${maxLat}`
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(categoryName)}.json?access_token=${MAPBOX_TOKEN}&bbox=${bbox}&limit=15&types=poi`
    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.error("POI fetch failed:", response.status)
        return
      }
      const data = await response.json()
      if (data.features) {
        const pois: TemporaryPoi[] = data.features.map((f: any) => ({
          id: f.id,
          placeName: f.text,
          address: f.place_name,
          lat: f.center[1],
          lng: f.center[0],
          categoryName: categoryName,   // store the category name
          countryCode: extractCountryCode(f),
        }))
        setTemporaryPois(pois)
      }
    } catch (error) {
      console.error("Error fetching POIs:", error)
    }
  }, [])

  // ---- Clear filter ----
  const clearFilter = useCallback(() => {
    setActiveCategoryId(null)
    setTemporaryPois([])
  }, [])

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
    activeCategoryId,
    setActiveCategoryId,
    filteredPins,
    temporaryPois,
    setTemporaryPois,
    fetchNearbyPois,
    clearFilter,
    mapBounds,
    setMapBounds,
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
