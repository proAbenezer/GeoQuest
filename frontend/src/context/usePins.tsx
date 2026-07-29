import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react"
import type { Pin } from "@/types"

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
      const response = await fetch("/api/pins", {
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
    const response = await fetch("/api/pins", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newPin),
    })

    if (!response.ok) {
      throw new Error("Failed to create pin")
    }

    const data = await response.json()

    setPins((prev) => [...prev, data.pin])

    return data.pin
  }

  async function toggleSaved(id: string) {
    const pin = pins.find((p) => p.id === id)

    if (!pin) return

    const response = await fetch(`/api/pins/${id}`, {
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

  return (
    <PinsContext.Provider
      value={{
        pins,
        loading,
        loadPins,
        addPin,
        secondaryPanel,
        setSecondaryPanel,
        listPanel,
        setListPanel,
        prefillLocation,
        setPrefillLocation,
        isManagingSaved,
        setIsManagingSaved,
        flyToTarget,
        setFlyToTarget,
        highlightedPinId,
        setHighlightedPinId,
        toggleSaved,
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
