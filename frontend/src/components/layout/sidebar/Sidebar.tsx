// components/layout/sidebar/Sidebar.tsx
import {
  Sidebar as SidebarRoot,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
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
import ExploreProgress from "./ExploreProgress"
import PinListPanels from "@/components/pins/PinListPanels"

const Sidebar = () => {
  const {
    listPanel,
    setListPanel,
    secondaryPanel,
    setSecondaryPanel,
    setIsManagingSaved,
  } = usePins()
  const { categories } = useCategories()

  // Icon + title for the pin list panel header, matching whichever
  // section (category / saved / recent) is currently active.
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

  return (
    <SidebarRoot 
      collapsible="icon" 
      className="border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      {/* Header with GeoQuest branding */}
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </div>
            <span className="font-heading text-lg font-semibold tracking-tight">GeoQuest</span>
          </div>
          <div className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarTrigger className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
          </div>
        </div>
      </SidebarHeader>

      {/* Content with card-style sections */}
      <SidebarContent className="px-3 py-4 space-y-3 group-data-[collapsible=icon]:px-2">
        {/* Explore Section - Card Style */}
        <div className="rounded-xl border bg-card/50 p-3 space-y-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:px-0">
            <Compass className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Explore</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full">
            {categories.slice(0, 3).map((c) => {
              const Icon = getCategoryIcon(c.id)
              const isActive = listPanel?.type === "categoryList" && listPanel.categoryId === c.id
              return (
                <button
                  key={c.id}
                  onClick={() =>
                    setListPanel(
                      isActive
                        ? null
                        : { type: "categoryList", categoryId: c.id }
                    )
                  }
                  className={`
                    flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                    group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5
                    ${isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-foreground hover:bg-muted/50"
                    }
                  `}
                >
                  <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="flex-1 text-left truncate group-data-[collapsible=icon]:hidden">{c.name}</span>
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Saved Section - Card Style */}
        <div className="rounded-xl border bg-card/50 p-3 space-y-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:px-0">
            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Saved</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full">
            <button
              onClick={() =>
                setListPanel(
                  listPanel?.type === "saved" ? null : { type: "saved" }
                )
              }
              className={`
                flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5
                ${listPanel?.type === "saved" 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-foreground hover:bg-muted/50"
                }
              `}
            >
              <Bookmark className={`h-4 w-4 flex-shrink-0 ${listPanel?.type === "saved" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Saved Places</span>
              {listPanel?.type === "saved" && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />
              )}
            </button>
            <button
              onClick={() => setIsManagingSaved(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-all hover:bg-muted/50 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5"
            >
              <Plus className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Save a Place</span>
            </button>
          </div>
        </div>

        {/* Recent Section - Card Style */}
        <div className="rounded-xl border bg-card/50 p-3 space-y-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:px-0">
            <History className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Recent</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full">
            <button
              onClick={() =>
                setListPanel(
                  listPanel?.type === "recentlyVisited"
                    ? null
                    : { type: "recentlyVisited" }
                )
              }
              className={`
                flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5
                ${listPanel?.type === "recentlyVisited" 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-foreground hover:bg-muted/50"
                }
              `}
            >
              <Clock className={`h-4 w-4 flex-shrink-0 ${listPanel?.type === "recentlyVisited" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Recently Visited</span>
              {listPanel?.type === "recentlyVisited" && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />
              )}
            </button>
          </div>
        </div>

        {/* Actions Section - Card Style */}
        <div className="rounded-xl border bg-card/50 p-3 space-y-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:px-0">
            <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Actions</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full">
            <button
              onClick={() =>
                setSecondaryPanel(
                  secondaryPanel?.type === "addPin" ? null : { type: "addPin" }
                )
              }
              className={`
                flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5
                ${secondaryPanel?.type === "addPin" 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-foreground hover:bg-muted/50"
                }
              `}
            >
              <Plus className={`h-4 w-4 flex-shrink-0 ${secondaryPanel?.type === "addPin" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">
                {secondaryPanel?.type === "addPin" ? "Cancel Adding" : "Add Pin"}
              </span>
              {secondaryPanel?.type === "addPin" && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />
              )}
            </button>
          </div>
        </div>

        {/* Settings Section - Card Style */}
        <div className="rounded-xl border bg-card/50 p-3 space-y-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
          <div className="flex items-center gap-2 px-1 text-muted-foreground group-data-[collapsible=icon]:px-0">
            <SettingsIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">Settings</h3>
          </div>
          <div className="space-y-0.5 group-data-[collapsible=icon]:w-full">
            <button
              onClick={() =>
                setSecondaryPanel(
                  secondaryPanel?.type === "settings"
                    ? null
                    : { type: "settings" }
                )
              }
              className={`
                flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all
                group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2.5
                ${secondaryPanel?.type === "settings" 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-foreground hover:bg-muted/50"
                }
              `}
            >
              <SettingsIcon className={`h-4 w-4 flex-shrink-0 ${secondaryPanel?.type === "settings" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Settings</span>
              {secondaryPanel?.type === "settings" && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />
              )}
            </button>
          </div>
        </div>

        {/* Pin List Section - Card Style (same as other sections) */}
        {listPanel && (
          <div className="rounded-xl border bg-card/50 p-3 space-y-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
            <div className="flex items-center justify-between px-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full">
              <div className="flex items-center gap-2 text-muted-foreground">
                <PanelIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <h3 className="text-xs font-semibold uppercase tracking-wider group-data-[collapsible=icon]:hidden">
                  {panelTitle}
                </h3>
              </div>
              <button
                onClick={() => setListPanel(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <PinListPanels />
          </div>
        )}
      </SidebarContent>

      {/* Footer with Progress */}
      <SidebarFooter className="border-t px-4 py-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <div className="group-data-[collapsible=icon]:hidden">
          <ExploreProgress percent={42} />
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <svg className="h-10 w-10 -rotate-90 transform">
              <circle
                cx="20"
                cy="20"
                r="16"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray={100}
                strokeDashoffset={58}
                className="text-primary transition-all duration-500"
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[10px] font-semibold text-foreground">42%</span>
          </div>
        </div>
      </SidebarFooter>
    </SidebarRoot>
  )
}

export default Sidebar
