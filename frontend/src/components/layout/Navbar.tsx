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
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useState, useRef, useEffect, useCallback } from "react"
import { usePins } from "@/context/usePins"
import { usePanelManager } from "@/hooks/usePanelManager"

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const quickFilters = [
  { label: "Anime Conventions", icon: Compass },
  { label: "Gyms", icon: Dumbbell },
  { label: "Tech Companies", icon: Building2 },
]

interface SearchResult {
  id: string
  place_name: string
  address: string
  center: [number, number]
}

const Navbar = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { setFlyToTarget } = usePins()
  const { openPreview } = usePanelManager()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

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

  // Search locations using Mapbox Geocoding API v5
  const searchLocations = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&types=place,address,poi,locality,neighborhood&language=en`
      
      console.log('🔍 Searching:', query)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        console.error('❌ Search API error:', response.status, response.statusText)
        setSearchResults([])
        setIsOpen(false)
        return
      }
      
      const data = await response.json()
      console.log('✅ Search results:', data)
      
      if (data.features && data.features.length > 0) {
        const results: SearchResult[] = data.features.map((feature: any) => ({
          id: feature.id,
          place_name: feature.place_name || feature.text || query,
          address: feature.place_name || feature.text || query,
          center: feature.center || feature.geometry?.coordinates || [0, 0],
        }))
        console.log('📋 Processed results:', results)
        setSearchResults(results)
        setIsOpen(true)
      } else {
        console.log('⚠️ No results found')
        setSearchResults([])
        setIsOpen(false)
      }
    } catch (error) {
      console.error("❌ Search failed:", error)
      setSearchResults([])
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchLocations(searchQuery)
      } else {
        setSearchResults([])
        setIsOpen(false)
      }
    }, 300)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [searchQuery, searchLocations])

  // Handle click outside to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Handle result selection
  const handleResultClick = (result: SearchResult) => {
    const [lng, lat] = result.center
    
    console.log('📍 Selected:', result.place_name, 'at', lat, lng)
    
    // Fly to the location on the map
    setFlyToTarget({ latitude: lat, longitude: lng })
    
    // Open preview panel with the location
    openPreview({
      placeName: result.place_name.split(",")[0] || result.place_name,
      address: result.address || result.place_name,
      lat,
      lng,
    })
    
    // Clear search
    setSearchQuery("")
    setSearchResults([])
    setIsOpen(false)
  }

  // Handle quick filter click
  const handleFilterClick = (label: string) => {
    setSearchQuery(label)
    searchLocations(label)
  }

  // Clear search
  const clearSearch = () => {
    setSearchQuery("")
    setSearchResults([])
    setIsOpen(false)
  }

  return (
    <div className="flex items-center gap-3 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-2.5 shadow-sm">
      {/* Search with results dropdown */}
      <div className="relative flex-1 max-w-md" ref={searchRef}>
        <div className="relative rounded-lg border border-border/40 bg-card/40 transition-all hover:border-border/60 focus-within:border-primary/50 focus-within:bg-card/60">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search places..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) {
                setIsOpen(true)
              }
            }}
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

        {/* Search Results Dropdown */}
        {isOpen && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 z-[999] max-h-80 overflow-y-auto rounded-xl border border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg">
            <div className="py-1">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-2.5 text-left hover:bg-muted/40 transition-colors flex items-start gap-3 border-b border-border/20 last:border-0"
                >
                  <div className="mt-0.5">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-foreground">
                      {result.place_name.split(",")[0] || result.place_name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {result.address || result.place_name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter button */}
      <Button 
        variant="outline" 
        size="icon" 
        className="shrink-0 rounded-lg border-border/40 bg-card/40 hover:bg-muted/40 hover:border-border/60 transition-all"
      >
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
      </Button>

      {/* Quick filters */}
      <div className="hidden items-center gap-2 md:flex">
        {quickFilters.map(({ label, icon: Icon }) => (
          <Button 
            key={label} 
            variant="outline" 
            size="sm" 
            onClick={() => handleFilterClick(label)}
            className="gap-1.5 rounded-lg border-border/40 bg-card/40 text-sm font-normal text-foreground hover:bg-muted/40 hover:border-border/60 transition-all"
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            {label}
          </Button>
        ))}
      </div>

      {/* User avatar */}
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
