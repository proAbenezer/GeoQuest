// hooks/usePanelManager.ts
import { usePins } from "@/context/usePins"

export const usePanelManager = () => {
  const {
    secondaryPanel,
    setSecondaryPanel,
    setPrefillLocation,
    setFlyToTarget,
    setHighlightedPinId,
  } = usePins()

  /**
   * Opens the Add Pin panel with optional pre-filled location data.
   * Closes any other panel first.
   */
  const openAddPin = (prefillData?: {
    placeName: string
    address: string
    latitude: number
    longitude: number
  }) => {
    // Close any existing panel
    setSecondaryPanel(null)

    // Set prefill data if provided
    if (prefillData) {
      setPrefillLocation(prefillData)
    }

    // Open add pin after a brief delay to ensure clean state
    setTimeout(() => {
      setSecondaryPanel({ type: "addPin" })
    }, 50)
  }

  /**
   * Opens the Preview panel (for an unlocked place).
   */
  const openPreview = (data: {
    placeName: string
    address: string
    lat: number
    lng: number
  }) => {
    setSecondaryPanel(null)
    setTimeout(() => {
      setSecondaryPanel({
        type: "preview",
        ...data,
      })
    }, 50)
  }

  /**
   * Opens the Pin Detail panel for a specific pin.
   * Also flies to the pin's location and highlights it.
   */
  const openPinDetail = (pin: any) => {
    setSecondaryPanel(null)
    if (pin.latitude && pin.longitude) {
      setFlyToTarget({ latitude: pin.latitude, longitude: pin.longitude })
    }
    setHighlightedPinId(pin.id)
    setTimeout(() => {
      setSecondaryPanel({ type: "pinDetail", pin })
    }, 50)
  }

  /**
   * Closes all panels and resets any prefill data.
   */
  const closeAllPanels = () => {
    setSecondaryPanel(null)
    setPrefillLocation(null)
    setHighlightedPinId(null)
  }

  /**
   * Toggles the Add Pin panel (opens if closed, closes if open).
   */
  const toggleAddPin = (prefillData?: {
    placeName: string
    address: string
    latitude: number
    longitude: number
  }) => {
    if (secondaryPanel?.type === "addPin") {
      closeAllPanels()
    } else {
      openAddPin(prefillData)
    }
  }

  // Convenience booleans
  const isAddPinOpen = secondaryPanel?.type === "addPin"
  const isPreviewOpen = secondaryPanel?.type === "preview"
  const isPinDetailOpen = secondaryPanel?.type === "pinDetail"

  return {
    openAddPin,
    openPreview,
    openPinDetail,
    closeAllPanels,
    toggleAddPin,
    isAddPinOpen,
    isPreviewOpen,
    isPinDetailOpen,
  }
}
