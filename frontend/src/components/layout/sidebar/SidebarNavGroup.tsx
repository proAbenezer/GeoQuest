import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import type { LucideIcon } from "lucide-react"

export type NavItem = {
  label: string
  icon: LucideIcon
  onClick?: () => void
  active?: boolean
  onAction?: () => void
  actionIcon?: LucideIcon
}

type Props = {
  label: string
  items: NavItem[]
}

const activeClass =
  "bg-[#D97B29]/15 text-[#D97B29] hover:bg-[#D97B29]/20 hover:text-[#D97B29]"

const SidebarNavGroup = ({ label, items }: Props) => (
  <SidebarGroup>
    <SidebarGroupLabel>{label}</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {items.map(
          ({
            label: itemLabel,
            icon: Icon,
            onClick,
            active,
            onAction,
            actionIcon: ActionIcon,
          }) => (
            <SidebarMenuItem
              key={itemLabel}
              className="group/nav-item relative"
            >
              <SidebarMenuButton
                tooltip={itemLabel}
                onClick={onClick}
                className={active ? activeClass : ""}
              >
                <Icon />
                <span>{itemLabel}</span>
              </SidebarMenuButton>
              {onAction && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAction()
                  }}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground opacity-0 group-hover/nav-item:opacity-100 hover:bg-muted hover:text-foreground"
                >
                  {ActionIcon ? <ActionIcon className="h-3.5 w-3.5" /> : null}
                </button>
              )}
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
)

export default SidebarNavGroup
