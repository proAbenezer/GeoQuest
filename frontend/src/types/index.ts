
export interface Category {
  id: string
  name: string
  description: string
  mapboxCategory?: string
  icons?: string[]
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
  // Icons for this pin (multi-icon support); falls back to the category's icons
  icons?: string[]
}

// Optional: if you use a separate type for temporary POIs from Mapbox
// you can export it from here if needed, but it's internal to usePins.
// We'll keep it inside usePins.tsx for now.

// ---- Community comments ----
export interface CommentAuthor {
  id: string
  firstName: string
  lastName: string
  profileImage?: string | null
}

export interface Comment {
  id: string
  body: string
  parentId: string | null
  createdAt: string
  author: CommentAuthor
  netVotes: number
  myVote: 1 | -1 | null
  replies?: Comment[]
}

// A commentable target: a pinned location, an unlocked-but-unpinned location,
// or a route (start pin + end pin). latitude/longitude are the snapshot point
// used to locate the target on the map.
export type CommentTarget = {
  type: "pin" | "location" | "route"
  pinId?: string
  placeId?: string
  routeStartPinId?: string
  routeEndPinId?: string
  latitude?: number
  longitude?: number
}

export interface RelevantCommentResult {
  target: (CommentTarget & { name: string }) | null
  comments: Comment[]
}

