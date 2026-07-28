export type Suggestion = {
  mapbox_id: string
  name: string
  place_formatted?: string
  full_address?: string
}

export type SelectedLocation = {
  placeName: string
  address: string
  latitude: number
  longitude: number
}
