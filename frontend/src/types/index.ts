
export interface Category {
  id: string
  name: string
  description: string
  mapboxCategory?: string
}

export interface Pin {
  id: string
  // Official place info — from the map/reverse-geocode, always present.
  name: string
  description: string
  // User's own personal name/notes — optional, separate from the above.
  customName?: string | null
  customDescription?: string | null
  notes?: string
  visitDate?: string | null
  visited: boolean
  latitude: number
  longitude: number
  categoryId: Category["id"]
  imageUrl?: string
  saved?: boolean
  placeId: string
  // NEW: country code (ISO2) for the locked/unlocked logic
  countryCode?: string   // e.g., "US", "GB", "FR"
}

// Optional: if you use a separate type for temporary POIs from Mapbox
// you can export it from here if needed, but it's internal to usePins.
// We'll keep it inside usePins.tsx for now.
