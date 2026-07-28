import { useSidebar } from "@/components/ui/sidebar"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { X, Tag, ChevronRight, Bookmark } from "lucide-react"

const SettingsPanel = () => {
  const { state } = useSidebar()
  const { secondaryPanel, setSecondaryPanel, setIsManagingSaved } = usePins()
  const { setIsManagingCategories } = useCategories()

  if (secondaryPanel?.type !== "settings") return null

  return (
    <div
      className="fixed inset-y-0 z-40 w-80 overflow-y-auto border-r bg-background shadow-xl transition-[left] duration-200"
      style={{ left: state === "expanded" ? "16rem" : "3rem" }}
    >
      <div className="flex items-start justify-between border-b px-5 py-4">
        <h2 className="text-lg font-semibold">Settings</h2>
        <button
          onClick={() => setSecondaryPanel(null)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div>
        <button
          onClick={() => setIsManagingCategories(true)}
          className="flex w-full items-center justify-between border-b px-5 py-3 text-sm hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Categories
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => setIsManagingSaved(true)}
          className="flex w-full items-center justify-between border-b px-5 py-3 text-sm hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            Saved Places
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}

export default SettingsPanel
