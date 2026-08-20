// AppLayout.tsx
import { Outlet } from "react-router-dom"
import { SidebarProvider } from "@/components/ui/sidebar"
import Navbar from "@/components/layout/Navbar"
import Sidebar from "@/components/layout/sidebar/Sidebar"
import { PinsProvider } from "@/context/usePins"
import PinDetailPanel from "../pins/PinDetailPanel"
import AddPinPanel from "../pins/AddPinForm"
import PreviewPanel from "../pins/PreviewPanel"
import SettingsPanel from "@/components/layout/SettingsPanel"
import CategoryManagerDialog from "@/components/layout/category/CategoryManagerDialog"
import SavedPlacesPanel from "@/components/layout/savedPlace/SavedPlacesPanel"  
import { CategoriesProvider } from "@/context/useCategories"
import { AuthProvider } from "@/context/AuthContext"

const AppLayout = () => {
  return (
    <AuthProvider>
      <PinsProvider>
        <CategoriesProvider>
          <SidebarProvider defaultOpen={false}>
            <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
              <Sidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <Navbar />
                <main className="flex-1 overflow-auto p-4">
                  <Outlet />
                </main>
              </div>
              <PinDetailPanel />
              <AddPinPanel />
              <PreviewPanel />
              <SettingsPanel />
              <SavedPlacesPanel />
              <CategoryManagerDialog />
            </div>
          </SidebarProvider>
        </CategoriesProvider>
      </PinsProvider>
    </AuthProvider>
  )
}

export default AppLayout
