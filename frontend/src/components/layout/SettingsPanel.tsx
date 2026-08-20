// components/layout/SettingsPanel.tsx
import { useSidebar } from "@/components/ui/sidebar"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { X, Tag, ChevronRight, Bookmark, Settings as SettingsIcon } from "lucide-react"

const SettingsPanel = () => {
  const { state } = useSidebar()
  const { secondaryPanel, setSecondaryPanel, setIsManagingSaved } = usePins()
  const { setIsManagingCategories } = useCategories()

  if (secondaryPanel?.type !== "settings") return null

  const sidebarWidth = state === "expanded" ? "16rem" : "4.5rem"

  return (
    <div
      className="fixed inset-y-0 z-50 w-80 overflow-y-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-r shadow-xl transition-[left] duration-200"
      style={{ left: sidebarWidth }}
    >
      {/* Header - matches AddPin panel style */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SettingsIcon className="h-4 w-4" />
            </div>
            <span className="font-heading text-lg font-semibold tracking-tight">Settings</span>
          </div>
          <button
            onClick={() => setSecondaryPanel(null)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content - matches AddPin panel style */}
      <div className="px-3 py-4 space-y-3">
        {/* Categories - Card Style */}
        <div className="rounded-xl border bg-card/50 p-3 space-y-2">
          <button
            onClick={() => {
              setSecondaryPanel(null)
              setTimeout(() => {
                setIsManagingCategories(true)
              }, 50)
            }}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all hover:bg-muted/50"
          >
            <span className="flex items-center gap-2.5">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">Categories</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Saved Places - Card Style */}
        <div className="rounded-xl border bg-card/50 p-3 space-y-2">
          <button
            onClick={() => {
              setSecondaryPanel(null)
              setTimeout(() => {
                setIsManagingSaved(true)
              }, 50)
            }}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all hover:bg-muted/50"
          >
            <span className="flex items-center gap-2.5">
              <Bookmark className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">Saved Places</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
