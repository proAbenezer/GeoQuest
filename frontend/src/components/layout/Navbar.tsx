// components/layout/Navbar.tsx
import { useNavigate } from "react-router-dom"
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
  X,
  Loader2,
  MapPin,
  Shield,
  type LucideIcon,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useState, useRef, useEffect, useCallback } from "react"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { usePanelManager } from "@/hooks/usePanelManager"
import { notifyLocked } from "@/lib/notify"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// Map category names to icons
const categoryIconMap: Record<string, LucideIcon> = {
  "Anime Conventions": Compass,
  "Gyms": Dumbbell,
  "Tech Companies": Building2,
  // Add more as needed
}

// Default icon for unknown categories
const DefaultIcon = MapPin

interface SearchResult {
  id: string
  place_name: string
  address: string
  center: [number, number]
  countryCode?: string
}

function extractCountryCode(feature: any): string | undefined {
  if (feature.place_type?.includes("country") && feature.properties?.short_code) {
    return feature.properties.short_code.toUpperCase()
  }
  const countryContext = feature.context?.find((c: any) => c.id?.startsWith("country"))
  return countryContext?.short_code?.toUpperCase()
}

interface NavbarProps {
  visitedIso2?: Set<string>
  onFilterClick?: (categoryName: string) => void
}

const Navbar = ({ visitedIso2 = new Set(), onFilterClick }: NavbarProps) => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { setFlyToTarget, activeCategoryId, clearFilter, setActiveCategoryId } = usePins()
  const { categories, loading: categoriesLoading } = useCategories()
  const { openPreview } = usePanelManager()

  const unlockedIso2 = visitedIso2 || new Set<string>()

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : "GQ"

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/login")
    } catch (err) {
      console.error("Failed to log out", err)
    }
  }

  const searchLocations = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      setIsOpen(false)
      return
    }

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&types=place,address,poi,locality,neighborhood&language=en`
      const response = await fetch(url, { signal: controller.signal })

      if (!response.ok) {
        console.error("Geocoding request failed:", response.status)
        setSearchResults([])
        setIsOpen(false)
        return
      }

      const data = await response.json()
      if (data.features && data.features.length > 0) {
        const results: SearchResult[] = data.features.map((feature: any) => ({
          id: feature.id,
          place_name: feature.place_name || feature.text || query,
          address: feature.place_name || feature.text || query,
          center: feature.center || feature.geometry?.coordinates || [0, 0],
          countryCode: extractCountryCode(feature),
        }))
        setSearchResults(results)
        setIsOpen(true)
        setSelectedIndex(-1)
      } else {
        setSearchResults([])
        setIsOpen(true)
      }
    } catch (error: any) {
      if (error.name === "AbortError") return
      console.error("Search failed:", error)
      setSearchResults([])
      setIsOpen(false)
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchLocations(searchQuery)
      } else {
        setSearchResults([])
        setIsOpen(false)
      }
    }, 300)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [searchQuery, searchLocations])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    return () => abortControllerRef.current?.abort()
  }, [])

  const handleResultClick = (result: SearchResult) => {
    const [lng, lat] = result.center
    const isLocked = !!result.countryCode && !unlockedIso2.has(result.countryCode)
    const placeName = result.place_name.split(",")[0] || result.place_name

    setFlyToTarget({ latitude: lat, longitude: lng })

    if (isLocked) {
      notifyLocked(`${placeName} is locked`)
    } else {
      openPreview({
        placeName,
        address: result.address || result.place_name,
        lat,
        lng,
      })
    }

    setSearchQuery("")
    setSearchResults([])
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  const handleFilterClick = (categoryId: string, categoryName: string) => {
    if (activeCategoryId === categoryId) {
      clearFilter()
      return
    }

    setActiveCategoryId(categoryId)
    if (onFilterClick) {
      onFilterClick(categoryName)
    }
  }

  const clearSearch = () => {
    setSearchQuery("")
    setSearchResults([])
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleResultClick(searchResults[selectedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setSelectedIndex(-1)
    }
  }

  // Get the icon for a category name
  const getIcon = (name: string): LucideIcon => {
    return categoryIconMap[name] || DefaultIcon
  }

  return (
    <div className="relative z-50 flex items-center gap-3 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-2.5 shadow-sm">
      <div className="relative flex-1 max-w-md" ref={searchRef}>
        <div className="relative rounded-lg border border-border/40 bg-card/40 transition-all hover:border-border/60 focus-within:border-primary/50 focus-within:bg-card/60">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search places..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setIsOpen(true)
            }}
            onKeyDown={handleKeyDown}
            className="border-0 bg-transparent pl-9 pr-9 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isLoading && (
            <div className="absolute top-1/2 right-3 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 z-[999] max-h-80 overflow-y-auto rounded-xl border border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90 shadow-xl">
            {searchResults.length > 0 ? (
              <div className="py-1">
                {searchResults.map((result, index) => {
                  const isLocked = !!result.countryCode && !unlockedIso2.has(result.countryCode)
                  const isSelected = index === selectedIndex

                  return (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`
                        w-full px-4 py-2.5 text-left transition-all duration-150
                        flex items-start gap-3 
                        border-b border-border/20 last:border-0
                        ${isLocked ? 'opacity-60 hover:bg-muted/20' : 'hover:bg-primary/5'}
                        ${isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : ''}
                        focus:outline-none
                      `}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {isLocked ? (
                          <Shield className="h-4 w-4 text-muted-foreground/60" />
                        ) : (
                          <MapPin className="h-4 w-4 text-muted-foreground/60" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-foreground flex items-center gap-1.5">
                          <span className="truncate">{result.place_name.split(",")[0] || result.place_name}</span>
                          {isLocked && (
                            <span className="shrink-0 text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                              Locked
                            </span>
                          )}
                          {result.countryCode && !isLocked && (
                            <span className="shrink-0 text-[10px] font-medium text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded-full">
                              {result.countryCode}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground/80 truncate">
                          {result.address || result.place_name}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              !isLoading && (
                <div className="px-4 py-6 text-sm text-muted-foreground text-center flex flex-col items-center gap-1">
                  <Search className="h-5 w-5 text-muted-foreground/40" />
                  <span>No results found</span>
                  <span className="text-xs text-muted-foreground/60">Try a different search term</span>
                </div>
              )
            )}
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="icon"
        className="shrink-0 rounded-lg border-border/40 bg-card/40 hover:bg-muted/40 hover:border-border/60 transition-all"
      >
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
      </Button>

      <div className="hidden items-center gap-2 md:flex">
        {categoriesLoading ? (
          // Optionally show a loader or placeholder
          <span className="text-xs text-muted-foreground">Loading categories...</span>
        ) : (
          <>
            {categories?.map((category) => {
              const isActive = activeCategoryId === category.id
              const Icon = getIcon(category.name)
              return (
                <Button
                  key={category.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterClick(category.id, category.name)}
                  className={`
                    gap-1.5 rounded-lg border-border/40 bg-card/40 
                    text-sm font-normal text-foreground 
                    hover:bg-muted/40 hover:border-border/60 
                    transition-all
                    ${isActive ? 'bg-primary/20 border-primary/50 ring-1 ring-primary/30' : ''}
                  `}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  {category.name}
                </Button>
              )
            })}
          </>
        )}
        {activeCategoryId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilter}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-8 w-8 cursor-pointer rounded-lg border border-border/40 bg-card/40 hover:bg-muted/40 transition-all">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="rounded-xl border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg"
          >
            <DropdownMenuItem
              onClick={() => navigate("/profile")}
              className="rounded-lg text-sm hover:bg-muted/40 transition-colors"
            >
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/40" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default Navbar
