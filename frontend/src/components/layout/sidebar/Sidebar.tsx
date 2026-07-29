import { useNavigate } from "react-router-dom"
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
} from "lucide-react"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { useAuth } from "@/context/AuthContext"
import { getCategoryIcon } from "@/lib/categoryDisplay"
import ExploreProgress from "./ExploreProgress"
import SidebarNavGroup from "./SidebarNavGroup"
import PinListPanels from "@/components/pins/PinListPanels"

const Sidebar = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    listPanel,
    setListPanel,
    secondaryPanel,
    setSecondaryPanel,
    isAddingPin,
    setIsAddingPin,
    setIsManagingSaved,
  } = usePins()
  const { categories } = useCategories()

  const requireAuth = (action: () => void) => {
    if (!user) {
      navigate("/login")
      return
    }
    action()
  }

  return (
    <SidebarRoot collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <MapPin className="h-5 w-5" />
            <span className="font-heading font-semibold">GeoQuest</span>
          </div>
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavGroup
          label="Explore"
          items={categories.map((c) => ({
            label: c.name,
            icon: getCategoryIcon(c.id),
            onClick: () =>
              setListPanel(
                listPanel?.type === "categoryList" &&
                  listPanel.categoryId === c.id
                  ? null
                  : { type: "categoryList", categoryId: c.id }
              ),
            active:
              listPanel?.type === "categoryList" &&
              listPanel.categoryId === c.id,
          }))}
        />
        <SidebarNavGroup
          label="Saved"
          items={[
            {
              label: "Saved Places",
              icon: Bookmark,
              onClick: () =>
                requireAuth(() =>
                  setListPanel(
                    listPanel?.type === "saved" ? null : { type: "saved" }
                  )
                ),
              active: listPanel?.type === "saved",
            },
            {
              label: "Save a Place",
              icon: Plus,
              onClick: () => requireAuth(() => setIsManagingSaved(true)),
            },
          ]}
        />
        <SidebarNavGroup
          label="Recent"
          items={[
            {
              label: "Recently Visited",
              icon: Clock,
              onClick: () =>
                requireAuth(() =>
                  setListPanel(
                    listPanel?.type === "recentlyVisited"
                      ? null
                      : { type: "recentlyVisited" }
                  )
                ),
              active: listPanel?.type === "recentlyVisited",
            },
          ]}
        />
        <SidebarNavGroup
          label="Actions"
          items={[
            {
              label:
                secondaryPanel?.type === "addPin"
                  ? "Cancel Adding Pin"
                  : "Add Pin",
              icon: Plus,
              onClick: () =>
                requireAuth(() =>
                  setSecondaryPanel(
                    secondaryPanel?.type === "addPin" ? null : { type: "addPin" }
                  )
                ),
              active: secondaryPanel?.type === "addPin",
            },
          ]}
        />
        <SidebarNavGroup
          label="Settings"
          items={[
            {
              label: "Settings",
              icon: SettingsIcon,
              onClick: () =>
                requireAuth(() =>
                  setSecondaryPanel(
                    secondaryPanel?.type === "settings"
                      ? null
                      : { type: "settings" }
                  )
                ),
              active: secondaryPanel?.type === "settings",
            },
          ]}
        />
        <PinListPanels />
      </SidebarContent>
      <SidebarFooter>
        <ExploreProgress percent={42} />
      </SidebarFooter>
    </SidebarRoot>
  )
}

export default Sidebar
