export interface Category {
  id: string
  name: string
  description: string
}

export interface Pin {
  id: string
  name: string
  description: string
  notes?: string
  visitDate?: string | null
  visited: boolean
  latitude: number
  longitude: number
  categoryId: Category["id"]
  imageUrl?: string
  saved?: boolean
}
