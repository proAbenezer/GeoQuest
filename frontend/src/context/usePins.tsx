import { createContext, useContext, useState, type ReactNode } from "react"
import type { Pin } from "@/types"
import { pins as initialPins } from "@/data/Pins"

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
type FlyToTarget = { latitude: number; longitude: number } | null
interface PinsContextValue {
  pins: Pin[]
  addPin: (pin: Omit<Pin, "id">) => Pin
  secondaryPanel: SecondaryPanel
  setSecondaryPanel: (panel: SecondaryPanel) => void
  listPanel: ListPanel
  setListPanel: (panel: ListPanel) => void
  prefillLocation: PrefillLocation
  setPrefillLocation: (location: PrefillLocation) => void
  isManagingSaved: boolean
  setIsManagingSaved: (v: boolean) => void
  toggleSaved: (id: string) => void
  flyToTarget: FlyToTarget
  setFlyToTarget: (target: FlyToTarget) => void
  highlightedPinId: string | null
  setHighlightedPinId: (id: string | null) => void
}
const PinsContext = createContext<PinsContextValue | undefined>(undefined)

export function PinsProvider({ children }: { children: ReactNode }) {
  const [pins, setPins] = useState<Pin[]>(initialPins)
  const [secondaryPanel, setSecondaryPanel] = useState<SecondaryPanel>(null)
  const [listPanel, setListPanel] = useState<ListPanel>(null)
  const [prefillLocation, setPrefillLocation] = useState<PrefillLocation>(null)
  const [isManagingSaved, setIsManagingSaved] = useState(false)
  const [flyToTarget, setFlyToTarget] = useState<FlyToTarget>(null)
  const [highlightedPinId, setHighlightedPinId] = useState<string | null>(null)
  const addPin = (newPin: Omit<Pin, "id">): Pin => {
    const pinWithId: Pin = {
      ...newPin,
      id: `pin-${Date.now()}`,
    }
    setPins((prev) => [...prev, pinWithId])
    return pinWithId
  }

  const toggleSaved = (id: string) => {
    setPins((prev) =>
      prev.map((pin) => (pin.id === id ? { ...pin, saved: !pin.saved } : pin))
    )
  }

  return (
    <PinsContext.Provider
      value={{
        pins,
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
