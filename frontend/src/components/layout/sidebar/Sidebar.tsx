// components/layout/sidebar/Sidebar.tsx
import { useRef, useEffect } from "react"
import {
  Sidebar as SidebarRoot,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Bookmark,
  Clock,
  MapPin,
  Plus,
  Settings as SettingsIcon,
  Compass,
  FolderOpen,
  History,
  Sparkles,
  Star,
  X,
} from "lucide-react"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { getCategoryIcon } from "@/lib/categoryDisplay"
import { useRecentlyVisited } from "@/hooks/useRecentlyVisited"
import ExploreProgress from "./ExploreProgress"

const Sidebar = () => {
  const {
    listPanel,
    setListPanel,
    secondaryPanel,
    setSecondaryPanel,
    pins,
    setFlyToTarget,
    setHighlightedPinId,
    setPrefillLocation,
  } = usePins()
  const { categories } = useCategories()
  const { items: recentlyVisitedItems, loading: recentlyVisitedLoading } = useRecentlyVisited()
  const { state } = useSidebar()
  const collapsed = state === "collapsed"

  const sidebarRef = useRef<HTMLDivElement>(null)

  // MEASURE THE ACTUAL WIDTH and set the CSS variable
  useEffect(() => {
    const el = sidebarRef.current
    if (!el) return

    const updateWidth = () => {
      const width = el.getBoundingClientRect().width
      document.documentElement.style.setProperty("--sidebar-width", `${width}px`)
    }

    // Set initial width
    updateWidth()

    // Observe changes
    const ro = new ResizeObserver(updateWidth)
    ro.observe(el)

    return () => ro.disconnect()
  }, [])

  // ... rest of your component logic (getPinRowIcon, handlePinClick, etc.)
  let PanelIcon = MapPin
  let panelTitle = ""
  if (listPanel?.type === "categoryList") {
    const activeCategory = categories.find((c) => c.id === listPanel.categoryId)
    PanelIcon = activeCategory ? getCategoryIcon(activeCategory.id) : FolderOpen
    panelTitle = activeCategory?.name ?? "Category"
  } else if (listPanel?.type === "saved") {
    PanelIcon = Star
    panelTitle = "Saved Places"
  } else if (listPanel?.type === "recentlyVisited") {
    PanelIcon = Clock
    panelTitle = "Recently Visited"
  }

  const getPinRowIcon = () => {
    if (!listPanel) return MapPin
    switch (listPanel.type) {
      case "saved":
        return Star
      case "recentlyVisited":
        return Clock
      case "categoryList": {
        const category = categories.find((c) => c.id === listPanel.categoryId)
        return category ? getCategoryIcon(category.id) : FolderOpen
      }
      default:
        return MapPin
    }
  }

  const getDisplayedPins = () => {
    if (!listPanel) return []
    switch (listPanel.type) {
      case "saved":
        return pins.filter((p) => p.saved)
      case "categoryList":
        return pins.filter((p) => p.categoryId === listPanel.categoryId)
      default:
        return []
    }
  }

  const PinRowIcon = getPinRowIcon()
  const displayedPins = getDisplayedPins()

  const handlePinClick = (pin: any) => {
    setSecondaryPanel(null)
    setFlyToTarget({ latitude: pin.latitude, longitude: pin.longitude })
    setHighlightedPinId(pin.id)
    setTimeout(() => {
      setSecondaryPanel({ type: "pinDetail", pin })
    }, 50)
  }

  return (
    <SidebarRoot
      ref={sidebarRef}
      collapsible="icon"
      className="relative z-30 h-full border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm flex-shrink-0"
    >
      {/* ... the entire existing content unchanged */}
    </SidebarRoot>
  )
}

export default Sidebar
