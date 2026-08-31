import {
  Compass,
  Dumbbell,
  Building2,
  Wrench,
  Tag,
  Coffee,
  Star,
  Map,
  Camera,
  Music,
  Book,
  Briefcase,
  Heart,
  Flag,
  Sparkles,
  Landmark,
  Utensils,
  TreePine,
  ShoppingBag,
  Gamepad2,
  Palette,
  Plane,
  PawPrint,
  Bike,
  Film,
  GraduationCap,
  Hotel,
  Stethoscope,
  type LucideIcon,
} from "lucide-react"

// Icon identifiers a category or pin can carry. The identifier is the key here
// (lowercase kebab-case) — it's what gets persisted in the `icons` column and
// sent to/from the API, so it stays stable across icon-name refactors.
export const ICON_CATALOG: Record<string, LucideIcon> = {
  compass: Compass,
  dumbbell: Dumbbell,
  building2: Building2,
  wrench: Wrench,
  coffee: Coffee,
  star: Star,
  map: Map,
  camera: Camera,
  music: Music,
  book: Book,
  briefcase: Briefcase,
  heart: Heart,
  flag: Flag,
  sparkles: Sparkles,
  landmark: Landmark,
  utensils: Utensils,
  "tree-pine": TreePine,
  "shopping-bag": ShoppingBag,
  gamepad2: Gamepad2,
  palette: Palette,
  plane: Plane,
  "paw-print": PawPrint,
  bike: Bike,
  film: Film,
  graduationcap: GraduationCap,
  hotel: Hotel,
  stethoscope: Stethoscope,
}

// The catalog keys, in order — what the multi-select picker renders.
export const ICON_IDENTIFIERS = Object.keys(ICON_CATALOG)

// Resolve a single persisted identifier to a Lucide component.
export function resolveIcon(identifier: string): LucideIcon {
  return ICON_CATALOG[identifier] ?? Tag
}

// Normalize a list of identifiers into a deduped list of Lucide components,
// falling back to `fallback` (or Tag) when nothing resolvable is given. This is
// the shared "render an icon cluster" entry point — callers that have an array
// render the whole list; single-icon callers can pass the array too.
export function getIconList(
  icons: string[] | undefined | null,
  fallback: LucideIcon = Tag
): LucideIcon[] {
  // Unknown identifiers resolve to Tag; drop those so a single bad id doesn't
  // render a generic tag inside an otherwise-valid cluster. Empty → fallback.
  const resolved = (icons ?? [])
    .map((id) => resolveIcon(id))
    .filter((icon) => icon !== Tag)
  const unique = Array.from(new Set(resolved))
  return unique.length > 0 ? unique : [fallback]
}

// Legacy demo map: falls back to a handful of hand-picked icons keyed by the
// placeholder category names. Real categories resolve through `icons` (via
// getIconList) and land here only when they have no icons of their own.
const categoryIcons: Record<string, LucideIcon> = {
  anime: Compass,
  gyms: Dumbbell,
  tech: Building2,
  workshops: Wrench,
}

export function getCategoryIcon(categoryId: string): LucideIcon {
  return categoryIcons[categoryId] ?? Tag
}
