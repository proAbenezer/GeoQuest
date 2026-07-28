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

const AppLayout = () => {
  return (
    <PinsProvider>
      <CategoriesProvider>
        <SidebarProvider>
          <Sidebar />
          <PinDetailPanel />
          <AddPinPanel />
          <SettingsPanel />
          <CategoryManagerDialog />
          <SavedPlacesManagerDialog />
          <div className="flex h-screen w-screen flex-col">
            <Navbar />
            <main className="h-full flex-1 overflow-auto">
              <Outlet />
            </main>
          </div>
        </SidebarProvider>
      </CategoriesProvider>
    </PinsProvider>
  )
}

export default AppLayout
