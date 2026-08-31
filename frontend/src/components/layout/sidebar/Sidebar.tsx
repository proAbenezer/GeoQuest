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
  MessageSquarePlus,
} from "lucide-react"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { getCategoryIcon, getIconList } from "@/lib/categoryDisplay"
import { IconStack } from "@/components/ui/icon-stack"
import { useRecentlyVisited } from "@/hooks/useRecentlyVisited"
import ExploreProgress from "./ExploreProgress"
import { useIsMobile } from "@/hooks/use-mobile"

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
  const { state, setOpenMobile } = useSidebar()
  const isMobile = useIsMobile()
  const collapsed = !isMobile && state === "collapsed"

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false)
  }

  // ✅ auto‑scroll to pin list section when it opens
  const pinListRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (listPanel && pinListRef.current) {
      pinListRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [listPanel])

  // ---- panel logic ----
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
    closeMobileSidebar() // opens pin detail panel, so close sidebar
    setSecondaryPanel(null)
    setFlyToTarget({ latitude: pin.latitude, longitude: pin.longitude })
    setHighlightedPinId(pin.id)
    setTimeout(() => {
      setSecondaryPanel({ type: "pinDetail", pin })
    }, 50)
  }

  return (
    <SidebarRoot
      collapsible="icon"
      className="relative z-30 h-full border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm flex-shrink-0"
    >
      <SidebarHeader className="border-b border-border/40 px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
              <MapPin className="h-4 w-4" />
            </div>
            <span className="font-heading text-lg font-semibold tracking-tight">GeoQuest</span>
          </div>
          <div className={`flex items-center ${collapsed ? "w-full justify-center" : "justify-end"}`}>
            <SidebarTrigger className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground" />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 overflow-y-auto px-3 py-4 space-y-2 group-data-[collapsible=icon]:px-2">
        {/* Explore Section */}
        <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:px-0">
            <Compass className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Explore</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full">
            {categories.slice(0, 3).map((c) => {
              const isActive = listPanel?.type === "categoryList" && listPanel.categoryId === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    // ✅ DO NOT close sidebar – keep it open to show the list
                    setListPanel(
                      isActive
                        ? null
                        : { type: "categoryList", categoryId: c.id }
                    )
                  }}
                  className={`
                    flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                    group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5
                    ${isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted/40"
                    }
                  `}
                >
                  <IconStack
                    icons={getIconList(c.icons, getCategoryIcon(c.id))}
                    size="h-4 w-4"
                    max={2}
                    className={`flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="flex-1 text-left truncate group-data-[collapsible=icon]:hidden">{c.name}</span>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Saved Section */}
        <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:px-0">
            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Saved</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full">
            <button
              onClick={() => {
                // ✅ DO NOT close sidebar – keep it open
                if (listPanel?.type === "saved") {
                  setListPanel(null)
                } else {
                  setListPanel({ type: "saved" })
                }
              }}
              className={`
                flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5
                ${listPanel?.type === "saved"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-muted/40"
                }
              `}
            >
              <Bookmark className={`h-4 w-4 flex-shrink-0 ${listPanel?.type === "saved" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Saved Places</span>
              {listPanel?.type === "saved" && <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />}
            </button>

            {/* ✅ This one OPENS a secondary panel – close sidebar */}
            <button
              onClick={() => {
                closeMobileSidebar()
                setSecondaryPanel(null)
                setTimeout(() => {
                  setSecondaryPanel({ type: "savedPlaces" })
                }, 50)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-all hover:bg-muted/40 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5"
            >
              <Plus className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Save a Place</span>
            </button>
          </div>
        </div>

        {/* Recent Section */}
        <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:px-0">
            <History className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Recent</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full">
            <button
              onClick={() => {
                // ✅ DO NOT close sidebar
                setListPanel(
                  listPanel?.type === "recentlyVisited"
                    ? null
                    : { type: "recentlyVisited" }
                )
              }}
              className={`
                flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5
                ${listPanel?.type === "recentlyVisited"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-muted/40"
                }
              `}
            >
              <Clock className={`h-4 w-4 flex-shrink-0 ${listPanel?.type === "recentlyVisited" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Recently Visited</span>
              {listPanel?.type === "recentlyVisited" && <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />}
            </button>
          </div>
        </div>

        {/* Actions Section */}
        <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:px-0">
            <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Actions</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full">
            {/* ✅ Add Pin – closes sidebar */}
            <button
              onClick={() => {
                closeMobileSidebar()
                if (secondaryPanel?.type === "addPin") {
                  setSecondaryPanel(null)
                } else {
                  setSecondaryPanel(null)
                  setTimeout(() => {
                    setSecondaryPanel({ type: "addPin" })
                  }, 50)
                }
              }}
              className={`
                flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5
                ${secondaryPanel?.type === "addPin"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-muted/40"
                }
              `}
            >
              <Plus className={`h-4 w-4 flex-shrink-0 ${secondaryPanel?.type === "addPin" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">
                {secondaryPanel?.type === "addPin" ? "Cancel Adding" : "Add Pin"}
              </span>
              {secondaryPanel?.type === "addPin" && <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />}
            </button>

            {/* ✅ Add Comment – closes sidebar */}
            <button
              onClick={() => {
                closeMobileSidebar()
                setSecondaryPanel(null)
                setTimeout(() => {
                  setSecondaryPanel({ type: "addComment" })
                }, 50)
              }}
              className={`
                flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5
                ${secondaryPanel?.type === "addComment"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-muted/40"
                }
              `}
            >
              <MessageSquarePlus className={`h-4 w-4 flex-shrink-0 ${secondaryPanel?.type === "addComment" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Add Comment</span>
              {secondaryPanel?.type === "addComment" && <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />}
            </button>
          </div>
        </div>

        {/* Settings Section */}
        <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:px-0">
            <SettingsIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Settings</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full">
            {/* ✅ Settings – closes sidebar */}
            <button
              onClick={() => {
                closeMobileSidebar()
                if (secondaryPanel?.type === "settings") {
                  setSecondaryPanel(null)
                } else {
                  setSecondaryPanel({ type: "settings" })
                }
              }}
              className={`
                flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5
                ${secondaryPanel?.type === "settings"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-muted/40"
                }
              `}
            >
              <SettingsIcon className={`h-4 w-4 flex-shrink-0 ${secondaryPanel?.type === "settings" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Settings</span>
              {secondaryPanel?.type === "settings" && <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />}
            </button>
          </div>
        </div>

        {/* Pin List Section – scrolls into view when listPanel opens */}
        {listPanel && (
          <div
            ref={pinListRef}
            className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors"
          >
            <div className="flex items-center justify-between px-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full">
              <div className="flex items-center gap-2 text-muted-foreground group-data-[collapsible=icon]:px-0">
                <PanelIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">{panelTitle}</h3>
              </div>
              <button
                onClick={() => setListPanel(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {listPanel.type === "recentlyVisited" ? (
              <div className="space-y-0.5 group-data-[collapsible=icon]:w-full">
                {recentlyVisitedLoading ? (
                  <div className="text-sm text-muted-foreground px-3 py-4 text-center group-data-[collapsible=icon]:hidden">Loading...</div>
                ) : recentlyVisitedItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground px-3 py-4 text-center group-data-[collapsible=icon]:hidden">No recently visited places yet.</div>
                ) : (
                  recentlyVisitedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all hover:bg-muted/40 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5"
                    >
                      <button
                        onClick={() => {
                          // clicking a recent item opens a panel – close sidebar
                          closeMobileSidebar()
                          if (item.isPin) {
                            const pin = pins.find((p) => p.id === item.pinId)
                            if (pin) {
                              setSecondaryPanel(null)
                              setFlyToTarget({
                                latitude: item.latitude || pin.latitude,
                                longitude: item.longitude || pin.longitude,
                              })
                              setHighlightedPinId(item.id)
                              setTimeout(() => {
                                setSecondaryPanel({ type: "pinDetail", pin })
                              }, 50)
                            }
                          } else {
                            setSecondaryPanel({
                              type: "preview",
                              placeName: item.name,
                              address: item.address || item.name,
                              lat: item.latitude || 0,
                              lng: item.longitude || 0,
                            })
                          }
                        }}
                        className="flex items-center gap-2.5 flex-1 min-w-0"
                      >
                        <Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="truncate text-left">{item.name}</span>
                        {item.isPin && <span className="text-[10px] text-primary/60 font-medium">pinned</span>}
                        {item.visitCount && item.visitCount > 1 && (
                          <span className="text-[10px] text-muted-foreground">({item.visitCount}x)</span>
                        )}
                      </button>
                      {!item.isPin && (
                        <button
                          onClick={() => {
                            // "Add pin" from recent – closes sidebar
                            closeMobileSidebar()
                            setSecondaryPanel(null)
                            setTimeout(() => {
                              setPrefillLocation({
                                placeName: item.name,
                                address: item.address || item.name,
                                latitude: item.latitude || 0,
                                longitude: item.longitude || 0,
                              })
                              setSecondaryPanel({ type: "addPin" })
                            }, 50)
                          }}
                          className="ml-2 rounded-lg p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors group-data-[collapsible=icon]:hidden"
                          title="Add pin at this location"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-0.5 group-data-[collapsible=icon]:w-full">
                {displayedPins.length === 0 ? (
                  <div className="text-sm text-muted-foreground px-3 py-4 text-center group-data-[collapsible=icon]:hidden">No pins found</div>
                ) : (
                  displayedPins.map((pin) => (
                    <button
                      key={pin.id}
                      onClick={() => handlePinClick(pin)} // handlePinClick closes sidebar
                      className={`
                        flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                        text-foreground hover:bg-muted/40
                        group-data-[collapsible=icon]:justify-center
                        group-data-[collapsible=icon]:px-2
                        group-data-[collapsible=icon]:py-2.5
                      `}
                    >
                      <PinRowIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-left truncate group-data-[collapsible=icon]:hidden">{pin.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 px-4 py-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <div className="group-data-[collapsible=icon]:hidden">
          <ExploreProgress percent={42} />
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <svg className="h-10 w-10 -rotate-90 transform">
              <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="none" className="text-muted/20" />
              <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray={100} strokeDashoffset={58} className="text-primary transition-all duration-500" strokeLinecap="round" />
            </svg>
            <span className="absolute text-[10px] font-semibold text-foreground">42%</span>
          </div>
        </div>
      </SidebarFooter>
    </SidebarRoot>
  )
}

export default Sidebar
