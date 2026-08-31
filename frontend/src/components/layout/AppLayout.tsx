// AppLayout.tsx
import { Outlet } from "react-router-dom"
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar"
import Navbar from "@/components/layout/Navbar"
import Sidebar from "@/components/layout/sidebar/Sidebar"
import { PinsProvider, usePins } from "@/context/usePins"
import PinDetailPanel from "../pins/PinDetailPanel"
import AddPinPanel from "../pins/AddPinForm"
import PreviewPanel from "../pins/PreviewPanel"
import SettingsPanel from "@/components/layout/SettingsPanel"
import CategoryManagerDialog from "@/components/layout/category/CategoryManagerDialog"
import SavedPlacesPanel from "@/components/layout/savedPlace/SavedPlacesPanel"
import AddCommentPanel from "@/components/comments/AddCommentPanel"
import { CategoriesProvider } from "@/context/useCategories"
import { Toaster } from "sonner"
import { useMemo, useEffect, useRef } from "react"

function AppLayoutContent() {
  const { state, open, setOpen, openMobile, setOpenMobile } = useSidebar()
  const { pins, secondaryPanel, setSecondaryPanel, filterPanelOpen, openFilterPanel, commentViewOpen, openCommentView } = usePins()

  // ---- Single-sidebar-open policy, main nav sidebar included ----
  // The overlay sidebars (secondaryPanel / filter / comment view) coordinate
  // with each other inside `usePins`. The main nav sidebar's open state lives
  // in the SidebarProvider, which wraps this layout — so the cross-sidebar
  // coordination has to happen here, where both contexts are in scope.

  // Opening the main nav sidebar (expand on desktop / mobile sheet) closes any
  // other sidebar that is currently open.
  const wasNavOpenRef = useRef(open)
  useEffect(() => {
    const opened = open && !wasNavOpenRef.current
    wasNavOpenRef.current = open
    if (opened) {
      setSecondaryPanel(null)
      openFilterPanel(false)
      openCommentView(false)
    }
  }, [open, setSecondaryPanel, openFilterPanel, openCommentView])

  const wasNavOpenMobileRef = useRef(openMobile)
  useEffect(() => {
    const opened = openMobile && !wasNavOpenMobileRef.current
    wasNavOpenMobileRef.current = openMobile
    if (opened) {
      setSecondaryPanel(null)
      openFilterPanel(false)
      openCommentView(false)
    }
  }, [openMobile, setSecondaryPanel, openFilterPanel, openCommentView])

  // Opening any other sidebar collapses the main nav sidebar, so only one
  // sidebar is ever visible at a time.
  const otherSidebarOpen = secondaryPanel !== null || filterPanelOpen || commentViewOpen
  const wasOtherSidebarOpenRef = useRef(otherSidebarOpen)
  useEffect(() => {
    const opened = otherSidebarOpen && !wasOtherSidebarOpenRef.current
    wasOtherSidebarOpenRef.current = otherSidebarOpen
    if (opened) {
      setOpen(false)
      setOpenMobile(false)
    }
  }, [otherSidebarOpen, setOpen, setOpenMobile])

  const visitedIso2 = useMemo(() => {
    const countries = new Set<string>()
    pins.forEach(pin => {
      if (pin.countryCode) {
        countries.add(pin.countryCode.toUpperCase())
      }
    })
    return countries
  }, [pins])

  return (
    <div
      className="app-shell flex h-dvh w-full bg-background text-foreground overflow-hidden"  // ← h-screen → h-dvh
      data-sidebar-state={state}
    >
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar visitedIso2={visitedIso2} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <PinDetailPanel />
      <AddPinPanel />
      <PreviewPanel />
      <SettingsPanel />
      <SavedPlacesPanel />
      <AddCommentPanel />
      <CategoryManagerDialog />

      <Toaster
        position="top-right"
        style={{ top: '4rem', right: '4rem', zIndex: 1000 }}
        toastOptions={{
          className: '!bg-card/95 !border !border-border/40 !text-foreground !shadow-xl !rounded-xl !backdrop-blur supports-[backdrop-filter]:!bg-card/90',
          duration: 4000,
        }}
      />
    </div>
  )
}

const AppLayout = () => {
  return (
    <PinsProvider>
      <CategoriesProvider>
        <SidebarProvider defaultOpen={false}>
          <AppLayoutContent />
        </SidebarProvider>
      </CategoriesProvider>
    </PinsProvider>
  )
}

export default AppLayout
