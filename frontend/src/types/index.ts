export interface Category {
  id: string
  name: string
  description: string
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
}

export type UnlockResult = {
  unlocked: boolean
  alreadyUnlocked?: boolean
  reason?: string
  district?: { id: string; name: string }
}
