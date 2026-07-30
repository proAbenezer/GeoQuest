import { Outlet } from "react-router-dom"
import { SidebarProvider } from "@/components/ui/sidebar"
import Navbar from "@/components/layout/Navbar"
import Sidebar from "@/components/layout/sidebar/Sidebar"
import { PinsProvider } from "@/context/usePins"
import PinDetailPanel from "../pins/PinDetailPanel"
import AddPinPanel from "../pins/AddPinForm"
import SettingsPanel from "@/components/layout/SettingsPanel"
import CategoryManagerDialog from "@/components/layout/category/CategoryManagerDialog"
import SavedPlacesManagerDialog from "./savedPlace/SavedPlacesManagerDialog"
import { CategoriesProvider } from "@/context/useCategories"
import { AuthProvider } from "@/context/AuthContext"

const AppLayout = () => {
  return (
    <AuthProvider>
      <PinsProvider>
        <CategoriesProvider>
          <SidebarProvider defaultOpen={false}>
            {/* Added theme background & text color classes here */}
            <div className="flex h-dvh w-full flex-col bg-background text-foreground">
              <Sidebar />
              <PinDetailPanel />
              <AddPinPanel />
              <SettingsPanel />
              <CategoryManagerDialog />
              <SavedPlacesManagerDialog />
              <Navbar />
              <main className="h-full flex-1 overflow-auto">
                <Outlet />
              </main>
            </div>
          </SidebarProvider>
        </CategoriesProvider>
      </PinsProvider>
    </AuthProvider>
  )
}

export default AppLayout
