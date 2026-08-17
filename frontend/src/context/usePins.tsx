import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react"
import type { Pin } from "@/types"
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

type SecondaryPanel =
  | { type: "pinDetail"; pin: Pin }
  | {
      type: "preview"
      placeName: string
      address: string
      lat: number
      lng: number
    }
  | { type: "settings" }
  | { type: "addPin" }
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
} | null

type FlyToTarget = {
  latitude: number
  longitude: number
} | null

interface PinsContextValue {
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
  isManagingSaved: boolean
  setIsManagingSaved: (v: boolean) => void
  toggleSaved: (id: string) => Promise<void>
  flyToTarget: FlyToTarget
  setFlyToTarget: (target: FlyToTarget) => void
  highlightedPinId: string | null
  setHighlightedPinId: (id: string | null) => void
}

const PinsContext = createContext<PinsContextValue | undefined>(undefined)

export function PinsProvider({ children }: { children: ReactNode }) {
  const [pins, setPins] = useState<Pin[]>([])
  const [loading, setLoading] = useState(true)

  const [secondaryPanel, setSecondaryPanel] =
    useState<SecondaryPanel>(null)

  const [listPanel, setListPanel] =
    useState<ListPanel>(null)

  const [prefillLocation, setPrefillLocation] =
    useState<PrefillLocation>(null)

  const [isManagingSaved, setIsManagingSaved] =
    useState(false)

  const [flyToTarget, setFlyToTarget] =
    useState<FlyToTarget>(null)

  const [highlightedPinId, setHighlightedPinId] =
    useState<string | null>(null)

  async function loadPins() {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/pins`, {
        credentials: "include",
      })
      const data = await response.json()
      setPins(data.pins)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPins()
  }, [])

  async function addPin(newPin: Omit<Pin, "id">): Promise<Pin> {
    const response = await fetch(`${API_BASE}/pins`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newPin),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to create pin")
    }
    setPins((prev) => [...prev, data.pin])
    return data.pin
  }

  async function toggleSaved(id: string) {
    const pin = pins.find((p) => p.id === id)
    if (!pin) return
    const response = await fetch(`${API_BASE}/pins/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        saved: !pin.saved,
      }),
    })
    if (!response.ok) return
    const data = await response.json()
    setPins((prev) =>
      prev.map((p) => (p.id === id ? data.pin : p))
    )
  }

  async function updatePin(id: string, updates: Partial<Pin>): Promise<Pin> {
    const response = await fetch(`${API_BASE}/pins/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to update pin")
    }
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

  return (
    <PinsContext.Provider
      value={{
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
        isManagingSaved,
        setIsManagingSaved,
        toggleSaved,
        flyToTarget,
        setFlyToTarget,
        highlightedPinId,
        setHighlightedPinId,
      }}
    >
      {children}
    </PinsContext.Provider>
  )
}

export function usePins() {
  const context = useContext(PinsContext)

  if (!context) {
    throw new Error("usePins must be used within a PinsProvider")
  }

  return context
}
