// components/layout/savedPlace/SavedPlacesPanel.tsx
import { useState } from "react"
import { useSidebar } from "@/components/ui/sidebar"
import { usePins } from "@/context/usePins"
import { X, Search, Bookmark, BookmarkCheck, Plus, Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"

const SavedPlacesPanel = () => {
  const { state } = useSidebar()
  const { pins, toggleSaved, secondaryPanel, setSecondaryPanel } = usePins()  // ✅ Changed from isManagingSaved
  const [searchQuery, setSearchQuery] = useState("")

  // ✅ Check secondaryPanel instead of isManagingSaved
  if (secondaryPanel?.type !== "savedPlaces") return null

  const savedPins = pins.filter((p) => p.saved)
  const unsavedPins = pins.filter((p) => !p.saved)

  const filteredUnsaved = searchQuery.trim()
    ? unsavedPins.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : unsavedPins

  const handleClose = () => {
    setSecondaryPanel(null)  // ✅ Use setSecondaryPanel instead of setIsManagingSaved
    setSearchQuery("")
  }

  // Match sidebar width
  const sidebarWidth = state === "expanded" ? "16rem" : "4.5rem"

  return (
    <div
      className="fixed inset-y-0 z-50 w-80 overflow-y-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-r shadow-xl transition-[left] duration-200"
      style={{ left: sidebarWidth }}
    >
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bookmark className="h-4 w-4" />
            </div>
            <span className="font-heading text-lg font-semibold tracking-tight">Saved Places</span>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-4 space-y-3">
        {/* Available Pins Section */}
        <div className="rounded-xl border bg-card/50 p-3 space-y-2">
          <div className="flex items-center gap-2 px-1 text-muted-foreground">
            <Plus className="h-3.5 w-3.5" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Available Pins to Save</h3>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search pins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-background/50 border-muted"
            />
          </div>
          
          {filteredUnsaved.length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-2 text-center">
              {searchQuery ? "No matching pins found." : "No pins available to save. Create a pin first!"}
            </p>
          ) : (
            <div className="space-y-0.5 max-h-60 overflow-y-auto">
              {filteredUnsaved.map((pin) => (
                <button
                  key={pin.id}
                  onClick={() => toggleSaved(pin.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all hover:bg-muted/50"
                >
                  <span className="truncate">{pin.name}</span>
                  <Bookmark className="h-4 w-4 flex-shrink-0 text-muted-foreground hover:text-orange-500 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Saved Places Section */}
        <div className="rounded-xl border bg-card/50 p-3 space-y-2">
          <div className="flex items-center gap-2 px-1 text-muted-foreground">
            <BookmarkCheck className="h-3.5 w-3.5" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Saved Places</h3>
          </div>
          
          {savedPins.length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-2 text-center">
              No saved places yet.
            </p>
          ) : (
            <div className="space-y-0.5 max-h-60 overflow-y-auto">
              {savedPins.map((pin) => (
                <div
                  key={pin.id}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all hover:bg-muted/50"
                >
                  <span className="truncate">{pin.name}</span>
                  <button
                    onClick={() => toggleSaved(pin.id)}
                    className="text-orange-500 hover:text-orange-600 transition-colors"
                  >
                    <BookmarkCheck className="h-4 w-4 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Action */}
        <div className="rounded-xl border bg-card/50 p-3 space-y-2">
          <div className="flex items-center gap-2 px-1 text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Quick Actions</h3>
          </div>
          <button
            onClick={() => {
              setSecondaryPanel(null)
              setTimeout(() => {
                setSecondaryPanel({ type: "addPin" })
              }, 50)
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all text-foreground hover:bg-muted/50"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-left">Create a New Pin</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default SavedPlacesPanel
