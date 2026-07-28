import {
  Compass,
  Dumbbell,
  Building2,
  Wrench,
  Tag,
  type LucideIcon,
} from "lucide-react"

const categoryIcons: Record<string, LucideIcon> = {
  anime: Compass,
  gyms: Dumbbell,
  tech: Building2,
  workshops: Wrench,
}

export function getCategoryIcon(categoryId: string): LucideIcon {
  return categoryIcons[categoryId] ?? Tag
}
