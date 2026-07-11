export interface Pin {
  id: string
  name: string
  description: string
  notes: string
  visitDate: string | null
  visited: boolean
  latitude: number
  longitude: number
  category: string
}
