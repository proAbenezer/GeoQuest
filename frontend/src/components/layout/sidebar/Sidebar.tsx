// components/layout/sidebar/Sidebar.tsx
import { useRef, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
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
  Tag,
  X,
  MessageCircle,
  MessageSquarePlus,
  LayoutDashboard,
} from "lucide-react"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { getCategoryIcon, getIconList } from "@/lib/categoryDisplay"
import { IconStack } from "@/components/ui/icon-stack"
import { useRecentlyVisited } from "@/hooks/useRecentlyVisited"
import { useConversationUnread } from "@/hooks/useConversations"
import { useExploreProgress } from "@/hooks/useExploreProgress"
import ExploreProgress, { formatExplorePercent } from "./ExploreProgress"
import { useIsMobile } from "@/hooks/use-mobile"

const Sidebar = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isOnDashboard = pathname === "/stats"
  const isOnMessages = pathname === "/messages" || pathname.startsWith("/messages/")
  const {
    listPanel,
    setListPanel,
    secondaryPanel,
    setSecondaryPanel,
    pins,
    setFlyToTarget,
    setHighlightedPinId,
    highlightedPinId,
    setPrefillLocation,
  } = usePins()
  const { categories, setIsManagingCategories } = useCategories()
  const { items: recentlyVisitedItems, loading: recentlyVisitedLoading } = useRecentlyVisited()
  const unreadMessages = useConversationUnread()
  const { state, setOpenMobile } = useSidebar()
  const isMobile = useIsMobile()
  const collapsed = !isMobile && state === "collapsed"
  const exploreProgress = useExploreProgress()

  // After picking a top-level destination that navigates AWAY (Dashboard), close
  // the mobile nav sheet. Opening secondary panels (pin detail, add pin, …) does
  // NOT close it — the main sidebar and those panels now coexist independently.
  const closeMobileNav = () => {
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

  const displayedPins = getDisplayedPins()

  const handlePinClick = (pin: any) => {
    // Opens the pin-detail panel — the main sidebar stays open (decoupled).
    setFlyToTarget({ latitude: pin.latitude, longitude: pin.longitude })
    setHighlightedPinId(pin.id)
    setSecondaryPanel({ type: "pinDetail", pin })
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
        {/* Dashboard – pinned to the top of the sidebar */}
        <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:space-y-0 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:hover:border-transparent group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors">
          <button
            onClick={() => {
              closeMobileNav()
              // Navigating to a different top-level view dismisses any open panel.
              setSecondaryPanel(null)
              navigate(isOnDashboard ? "/" : "/stats")
            }}
            className={`
              flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
              group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0
              ${isOnDashboard
                ? "bg-primary/10 text-primary font-medium group-data-[collapsible=icon]:bg-transparent"
                : "text-foreground hover:bg-muted/40 group-data-[collapsible=icon]:hover:bg-transparent"
              }
            `}
          >
            <LayoutDashboard className={`h-4 w-4 flex-shrink-0 ${isOnDashboard ? "text-primary" : "text-muted-foreground"}`} />
            <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Dashboard</span>
            {isOnDashboard && <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />}
          </button>
        </div>

        {/* Messages – top-level chat (navigates away to /messages, like Dashboard) */}
        <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:space-y-0 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:hover:border-transparent group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors">
          <button
            onClick={() => {
              closeMobileNav()
              // Navigating to a different top-level view dismisses any open panel.
              setSecondaryPanel(null)
              navigate("/messages")
            }}
            className={`
              flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
              group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0
              ${isOnMessages
                ? "bg-primary/10 text-primary font-medium group-data-[collapsible=icon]:bg-transparent"
                : "text-foreground hover:bg-muted/40 group-data-[collapsible=icon]:hover:bg-transparent"
              }
            `}
          >
            <span className="relative flex-shrink-0">
              <MessageCircle className={`h-4 w-4 ${isOnMessages ? "text-primary" : "text-muted-foreground"}`} />
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary ring-2 ring-card hidden group-data-[collapsible=icon]:block" />
              )}
            </span>
            <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Messages</span>
            {unreadMessages > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground group-data-[collapsible=icon]:hidden">
                {unreadMessages}
              </span>
            )}
            {isOnMessages && <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />}
          </button>
        </div>

        {/* Explore Section */}
        <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:space-y-0 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:hover:border-transparent group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:hidden">
            <Compass className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Explore</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
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
                    group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0
                    ${isActive
                      ? "bg-primary/10 text-primary font-medium group-data-[collapsible=icon]:bg-transparent"
                      : "text-foreground hover:bg-muted/40 group-data-[collapsible=icon]:hover:bg-transparent"
                    }
                  `}
                >
                  <IconStack
                    icons={getIconList(c.icons, getCategoryIcon(c.id))}
                    size="h-4 w-4"
                    max={collapsed ? 1 : 2}
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
        <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:space-y-0 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:hover:border-transparent group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:hidden">
            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Saved</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
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
                group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0
                ${listPanel?.type === "saved"
                  ? "bg-primary/10 text-primary font-medium group-data-[collapsible=icon]:bg-transparent"
                  : "text-foreground hover:bg-muted/40 group-data-[collapsible=icon]:hover:bg-transparent"
                }
              `}
            >
              <Bookmark className={`h-4 w-4 flex-shrink-0 ${listPanel?.type === "saved" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Saved Places</span>
              {listPanel?.type === "saved" && <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />}
            </button>

            <button
              onClick={() => setSecondaryPanel({ type: "savedPlaces" })}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-all hover:bg-muted/40 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:hover:bg-transparent"
            >
              <Plus className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Save a Place</span>
            </button>
          </div>
        </div>

        {/* Recent Section */}
        <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:space-y-0 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:hover:border-transparent group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:hidden">
            <History className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Recent</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
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
                group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0
                ${listPanel?.type === "recentlyVisited"
                  ? "bg-primary/10 text-primary font-medium group-data-[collapsible=icon]:bg-transparent"
                  : "text-foreground hover:bg-muted/40 group-data-[collapsible=icon]:hover:bg-transparent"
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
        <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:space-y-0 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:hover:border-transparent group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:hidden">
            <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Actions</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
            {/* ✅ Add Pin – opens the panel, keeps the main sidebar open */}
            <button
              onClick={() => {
                if (secondaryPanel?.type === "addPin") {
                  setSecondaryPanel(null)
                } else {
                  setSecondaryPanel({ type: "addPin" })
                }
              }}
              className={`
                flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0
                ${secondaryPanel?.type === "addPin"
                  ? "bg-primary/10 text-primary font-medium group-data-[collapsible=icon]:bg-transparent"
                  : "text-foreground hover:bg-muted/40 group-data-[collapsible=icon]:hover:bg-transparent"
                }
              `}
            >
              <Plus className={`h-4 w-4 flex-shrink-0 ${secondaryPanel?.type === "addPin" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">
                {secondaryPanel?.type === "addPin" ? "Cancel Adding" : "Add Pin"}
              </span>
              {secondaryPanel?.type === "addPin" && <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />}
            </button>

            {/* ✅ Add Comment – opens the panel, keeps the main sidebar open */}
            <button
              onClick={() => setSecondaryPanel({ type: "addComment" })}
              className={`
                flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0
                ${secondaryPanel?.type === "addComment"
                  ? "bg-primary/10 text-primary font-medium group-data-[collapsible=icon]:bg-transparent"
                  : "text-foreground hover:bg-muted/40 group-data-[collapsible=icon]:hover:bg-transparent"
                }
              `}
            >
              <MessageSquarePlus className={`h-4 w-4 flex-shrink-0 ${secondaryPanel?.type === "addComment" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Add Comment</span>
              {secondaryPanel?.type === "addComment" && <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />}
            </button>

            {/* ✅ Add Category – opens the category manager (add form on top) */}
            <button
              onClick={() => setIsManagingCategories(true)}
              className={`
                flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0
                text-foreground hover:bg-muted/40 group-data-[collapsible=icon]:hover:bg-transparent
              `}
            >
              <Tag className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Add Category</span>
            </button>
          </div>
        </div>

        {/* Settings Section */}
        <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:space-y-0 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:hover:border-transparent group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:hidden">
            <SettingsIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Settings</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
            {/* ✅ Settings – opens the panel, keeps the main sidebar open */}
            <button
              onClick={() => {
                if (secondaryPanel?.type === "settings") {
                  setSecondaryPanel(null)
                } else {
                  setSecondaryPanel({ type: "settings" })
                }
              }}
              className={`
                flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0
                ${secondaryPanel?.type === "settings"
                  ? "bg-primary/10 text-primary font-medium group-data-[collapsible=icon]:bg-transparent"
                  : "text-foreground hover:bg-muted/40 group-data-[collapsible=icon]:hover:bg-transparent"
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
            className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:space-y-0 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:hover:border-transparent group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center hover:border-border/60 transition-colors"
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
              <div className="space-y-0.5 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
                {recentlyVisitedLoading ? (
                  <div className="text-sm text-muted-foreground px-3 py-4 text-center group-data-[collapsible=icon]:hidden">Loading...</div>
                ) : recentlyVisitedItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground px-3 py-4 text-center group-data-[collapsible=icon]:hidden">No recently visited places yet.</div>
                ) : (
                  recentlyVisitedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all hover:bg-muted/40 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5 group-data-[collapsible=icon]:hover:bg-transparent"
                    >
                      <button
                        onClick={() => {
                          // Opens the panel — the main sidebar stays open.
                          if (item.isPin) {
                            const pin = pins.find((p) => p.id === item.pinId)
                            if (pin) {
                              setFlyToTarget({
                                latitude: item.latitude || pin.latitude,
                                longitude: item.longitude || pin.longitude,
                              })
                              setHighlightedPinId(pin.id)
                              setSecondaryPanel({ type: "pinDetail", pin })
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
                        <span className="truncate text-left group-data-[collapsible=icon]:hidden">{item.name}</span>
                        {item.isPin && <span className="text-[10px] text-primary/60 font-medium group-data-[collapsible=icon]:hidden">pinned</span>}
                        {item.visitCount && item.visitCount > 1 && (
                          <span className="text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">({item.visitCount}x)</span>
                        )}
                      </button>
                      {!item.isPin && (
                        <button
                          onClick={() => {
                            setPrefillLocation({
                              placeName: item.name,
                              address: item.address || item.name,
                              latitude: item.latitude || 0,
                              longitude: item.longitude || 0,
                            })
                            setSecondaryPanel({ type: "addPin" })
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
              <div className="space-y-0.5 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
                {displayedPins.length === 0 ? (
                  <div className="text-sm text-muted-foreground px-3 py-4 text-center group-data-[collapsible=icon]:hidden">No pins found</div>
                ) : (
                  displayedPins.map((pin) => (
                    <button
                      key={pin.id}
                      onClick={() => handlePinClick(pin)}
                      className={`
                        flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                        group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center
                        group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0
                        ${
                          highlightedPinId === pin.id
                            ? "bg-primary/15 text-primary font-medium group-data-[collapsible=icon]:bg-primary/15"
                            : "text-foreground hover:bg-primary/5 hover:text-primary group-data-[collapsible=icon]:hover:bg-primary/10"
                        }
                      `}
                    >
                      <IconStack
                        icons={getIconList(pin.icons, getCategoryIcon(pin.categoryId))}
                        size="h-4 w-4"
                        max={collapsed ? 1 : 2}
                        className={`flex-shrink-0 ${highlightedPinId === pin.id ? "text-primary" : "text-muted-foreground"}`}
                      />
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
          <ExploreProgress
            title={exploreProgress?.title ?? "Exploring…"}
            percent={exploreProgress?.percent ?? null}
          />
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center">
          <div className="relative flex h-8 w-8 items-center justify-center">
            <svg className="h-8 w-8 -rotate-90 transform" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="3" fill="none" className="text-muted/20" />
              <circle
                cx="16"
                cy="16"
                r="14"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray={2 * Math.PI * 14}
                strokeDashoffset={2 * Math.PI * 14 * (1 - (exploreProgress?.percent ?? 0) / 100)}
                className="text-primary transition-all duration-500"
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center whitespace-nowrap text-[9px] font-semibold leading-none text-foreground tabular-nums">
              {exploreProgress ? formatExplorePercent(exploreProgress.percent) : "–"}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </SidebarRoot>
  )
}

export default Sidebar
