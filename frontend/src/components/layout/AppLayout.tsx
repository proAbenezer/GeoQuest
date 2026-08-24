// AppLayout.tsx
import { Outlet } from "react-router-dom"
import { SidebarProvider } from "@/components/ui/sidebar"
import Navbar from "@/components/layout/Navbar"
import Sidebar from "@/components/layout/sidebar/Sidebar"
import { PinsProvider, usePins } from "@/context/usePins"
import PinDetailPanel from "../pins/PinDetailPanel"
import AddPinPanel from "../pins/AddPinForm"
import PreviewPanel from "../pins/PreviewPanel"
import SettingsPanel from "@/components/layout/SettingsPanel"
import CategoryManagerDialog from "@/components/layout/category/CategoryManagerDialog"
import SavedPlacesPanel from "@/components/layout/savedPlace/SavedPlacesPanel"
import { CategoriesProvider } from "@/context/useCategories"
import { AuthProvider } from "@/context/AuthContext"
import { Toaster } from "sonner"
import { useMemo } from "react"

// No context imports – Sidebar sets CSS variable itself

function AppLayoutContent() {
  const { pins, fetchNearbyPois, mapBounds } = usePins()

  const visitedIso2 = useMemo(() => {
    const countries = new Set<string>()
    pins.forEach(pin => {
      if (pin.countryCode) {
        countries.add(pin.countryCode.toUpperCase())
      }
    })
    return countries
  }, [pins])

  const handleFilterClick = (category: string) => {
    if (mapBounds) {
      fetchNearbyPois(category, mapBounds)
    } else {
      console.warn("Map bounds not available yet")
    }
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar no longer needs props */}
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar visitedIso2={visitedIso2} onFilterClick={handleFilterClick} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      {/* All panels will use the CSS variable */}
      <PinDetailPanel />
      <AddPinPanel />
      <PreviewPanel />
      <SettingsPanel />
      <SavedPlacesPanel />
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
    <AuthProvider>
      <PinsProvider>
        <CategoriesProvider>
          <SidebarProvider defaultOpen={false}>
            <AppLayoutContent />
          </SidebarProvider>
        </CategoriesProvider>
      </PinsProvider>
    </AuthProvider>
  )
}

export default AppLayout
