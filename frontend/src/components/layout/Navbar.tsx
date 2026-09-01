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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Search,
  SlidersHorizontal,
  X,
  Loader2,
  MapPin,
  Shield,
  Menu, // ✅ added Menu icon
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useState, useRef, useEffect, useCallback } from "react"
import { usePins } from "@/context/usePins"
import { useCategories } from "@/context/useCategories"
import { usePanelManager } from "@/hooks/usePanelManager"
import { notifyLocked } from "@/lib/notify"
import FilterPanel from "@/components/filter/FilterPanel"
import { useSidebar } from "@/components/ui/sidebar" // ✅ added for mobile toggle
import { getCategoryIcon, getIconList } from "@/lib/categoryDisplay"
import { IconStack } from "@/components/ui/icon-stack"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const VISIBLE_CATEGORY_COUNT = 3

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
}

const Navbar = ({ visitedIso2 = new Set() }: NavbarProps) => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { toggleSidebar, openMobile } = useSidebar() // ✅ for mobile hamburger
  const {
    setFlyToTarget,
    activeCategoryIds,
    toggleCategoryFilter,
    clearFilter,
    fetchNearbyPois,
    mapBounds,
    setTemporaryPois,
    pinVisibility,
    setPinVisibility,
    filterPanelOpen,
    openFilterPanel,
    setSecondaryPanel,
    openCommentView,
  } = usePins()
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

  // ---- auto‑fetch POIs when filter changes ----
  useEffect(() => {
    if (activeCategoryIds.length === 0 || !mapBounds) {
      setTemporaryPois([])
      return
    }
    const selectedCategories = activeCategoryIds
      .map((id) => {
        const cat = categories?.find((c) => c.id === id)
        return cat?.mapboxCategory ? { id: cat.id, mapboxCategory: cat.mapboxCategory } : null
      })
      .filter((c): c is { id: string; mapboxCategory: string } => Boolean(c))

    if (selectedCategories.length === 0) {
      setTemporaryPois([])
      return
    }
    fetchNearbyPois(selectedCategories, mapBounds)
  }, [activeCategoryIds, mapBounds, categories, fetchNearbyPois, setTemporaryPois])

  // ---- Search ----
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

  const visibleCategories = categories?.slice(0, VISIBLE_CATEGORY_COUNT) ?? []

  return (
    <div className="relative z-50 flex items-center gap-3 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-2.5 shadow-sm">
      {/* ✅ Mobile hamburger menu button – restored */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-lg md:hidden shrink-0"
        onClick={() => {
          // Opening the mobile nav is opening a sidebar — close the others so
          // only one sidebar is open at a time.
          if (!openMobile) {
            setSecondaryPanel(null)
            openFilterPanel(false)
            openCommentView(false)
          }
          toggleSidebar()
        }}
        aria-label="Toggle menu"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Logo — matches the sidebar's brand chip exactly */}
      <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
          <MapPin className="h-4 w-4" />
        </div>
        <span className="font-heading text-lg font-semibold tracking-tight">
          GeoQuest
        </span>
      </div>

      {/* Search */}
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
          <div className="absolute top-full left-0 right-0 mt-1.5 z-[999] max-h-80 overflow-y-auto rounded-xl border border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-xl">
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

      {/* Filter button */}
      <div className="relative shrink-0">
        <Button
          variant="outline"
          size="icon"
          onClick={() => openFilterPanel(!filterPanelOpen)}
          className={`shrink-0 rounded-lg relative ${
            activeCategoryIds.length > 0 ? 'border-primary/50 bg-primary/10' : 'border-border/40 bg-card/40'
          }`}
        >
          <SlidersHorizontal className={`h-4 w-4 ${activeCategoryIds.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
          {activeCategoryIds.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
              {activeCategoryIds.length}
            </span>
          )}
        </Button>
        {filterPanelOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)]">
            <FilterPanel
              categories={categories || []}
              activeCategoryIds={activeCategoryIds}
              onToggle={toggleCategoryFilter}
              onClear={() => {
                clearFilter()
                openFilterPanel(false)
              }}
              onClose={() => openFilterPanel(false)}
              pinVisibility={pinVisibility}
              onVisibilityChange={setPinVisibility}
            />
          </div>
        )}
      </div>

      {/* Quick category pills */}
      <div className="hidden items-center gap-2 md:flex">
        {categoriesLoading ? (
          <span className="text-xs text-muted-foreground">Loading categories...</span>
        ) : (
          visibleCategories.map((category) => {
            const isActive = activeCategoryIds.includes(category.id)
            return (
              <Button
                key={category.id}
                variant="outline"
                size="sm"
                onClick={() => toggleCategoryFilter(category.id)}
                className={`
                  gap-1.5 rounded-lg border-border/40 bg-card/40
                  text-sm text-foreground
                  hover:bg-muted/40 hover:border-border/60
                  transition-all
                  ${isActive ? 'bg-primary/10 text-primary font-medium border-primary/50' : ''}
                `}
              >
                <IconStack
                  icons={getIconList(category.icons, getCategoryIcon(category.id))}
                  size="h-4 w-4"
                  max={2}
                  className={`flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                />
                {category.name}
              </Button>
            )
          })
        )}
        {activeCategoryIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearFilter()
              openFilterPanel(false)
            }}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Profile avatar */}
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Avatar className="h-8 w-8 cursor-pointer rounded-lg bg-primary/10 text-primary shadow-sm hover:bg-primary/20 transition-all">
                <AvatarImage src={user?.profileImage || undefined} alt={user?.username ?? "Profile"} />
                <AvatarFallback className="bg-transparent text-primary text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
            }
          />
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
            <DropdownMenuItem
              onClick={() => navigate("/stats")}
              className="rounded-lg text-sm hover:bg-muted/40 transition-colors"
            >
              Stats
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
