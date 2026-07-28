import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Search,
  SlidersHorizontal,
  Compass,
  Dumbbell,
  Building2,
} from "lucide-react"

const quickFilters = [
  { label: "Anime Conventions", icon: Compass },
  { label: "Gyms", icon: Dumbbell },
  { label: "Tech Companies", icon: Building2 },
]

const Navbar = () => {
  return (
    <div className="flex items-center gap-3 border-b bg-background px-4 py-2.5 pl-[5%]">
      <div className="relative w-full max-w-sm">
        <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search places..." className="pl-8" />
      </div>

      <Button variant="outline" size="icon" className="shrink-0">
        <SlidersHorizontal className="h-4 w-4" />
      </Button>

      <div className="hidden items-center gap-2 md:flex">
        {quickFilters.map(({ label, icon: Icon }) => (
          <Button key={label} variant="outline" size="sm" className="gap-1.5">
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback>GQ</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default Navbar
