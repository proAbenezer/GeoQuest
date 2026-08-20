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

  const openAddPin = (prefillData?: {
    placeName: string
    address: string
    latitude: number
    longitude: number
  }) => {
    if (prefillData) {
      setPrefillLocation(prefillData)
    }
    setSecondaryPanel({ type: "addPin" })
  }

  const openPreview = (data: {
    placeName: string
    address: string
    lat: number
    lng: number
  }) => {
    setSecondaryPanel({ type: "preview", ...data })
  }

  const openPinDetail = (pin: any) => {
    setSecondaryPanel({ type: "pinDetail", pin })
  }

  const closeAllPanels = () => {
    setSecondaryPanel(null)
    setPrefillLocation(null)
    setHighlightedPinId(null)
  }

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

  return {
    openAddPin,
    openPreview,
    openPinDetail,
    closeAllPanels,
    toggleAddPin,
    isAddPinOpen: secondaryPanel?.type === "addPin",
    isPreviewOpen: secondaryPanel?.type === "preview",
    isPinDetailOpen: secondaryPanel?.type === "pinDetail",
  }
}
