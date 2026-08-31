import type { Place, UnlockedEntry, CountryFetchStatus } from "@/types/place"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

export async function fetchCountryPlaces(iso2: string): Promise<{ status: CountryFetchStatus; places: Place[] }> {
  const res = await fetch(`${API_BASE}/places/country/${iso2}`, { credentials: "include" })
  if (!res.ok) throw new Error(`Failed to fetch country ${iso2}: ${res.status}`)
  return res.json()
}

export async function fetchUnlockedPlaces(): Promise<{ unlocked: UnlockedEntry[] }> {
  const res = await fetch(`${API_BASE}/places/unlocked`, { credentials: "include" })
  if (!res.ok) throw new Error(`Failed to fetch unlocked places: ${res.status}`)
  return res.json()
}

export async function unlockPlace(placeId: string, latitude: number, longitude: number) {
  const res = await fetch(`${API_BASE}/places/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ placeId, latitude, longitude }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "Unlock failed")
  return data.unlock as { placeId: string; alreadyUnlocked?: boolean; unlockedAt?: string }
}
export async function fetchUnlockedCountries(): Promise<{ countryCodes: string[] }> {
  const res = await fetch(`${API_BASE}/places/unlocked-countries`, { credentials: "include" })
  if (!res.ok) throw new Error(`Failed to fetch unlocked countries: ${res.status}`)
  return res.json()
}
