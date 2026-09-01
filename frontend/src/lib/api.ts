import type { Place, UnlockedEntry, CountryFetchStatus, ExplorationEntry, TravelStats, CommentRoute } from "@/types/place"

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

// Stored per-node exploration roll-up for one country (read side of the
// exploration bar). The client never recomputes the hierarchy — see
// server/src/routes/places.ts GET /places/exploration.
export async function fetchExplorationPlaces(iso2: string): Promise<{ entries: ExplorationEntry[] }> {
  const res = await fetch(`${API_BASE}/places/exploration?iso2=${iso2}`, { credentials: "include" })
  if (!res.ok) throw new Error(`Failed to fetch exploration for ${iso2}: ${res.status}`)
  return res.json()
}

// Per-pin comment counts for marker badges (item 10). A pin's count includes
// comments targeted directly at it plus comments on routes where it's an
// endpoint (a route comment badges both endpoint pins).
export async function fetchCommentCounts(pinIds: string[]): Promise<Record<string, number>> {
  if (pinIds.length === 0) return {}
  const res = await fetch(`${API_BASE}/comments/counts?pinIds=${pinIds.join(",")}`, {
    credentials: "include",
  })
  if (!res.ok) throw new Error(`Failed to fetch comment counts: ${res.status}`)
  const data = await res.json()
  return data.counts as Record<string, number>
}

export async function unlockPlace(placeId: string, latitude: number, longitude: number) {
  const res = await fetch(`${API_BASE}/places/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    // timezoneOffsetMinutes: minutes to ADD to UTC for the traveler's local
    // time at check-in (east positive). Drives "distinct calendar day" bucketing.
    body: JSON.stringify({
      placeId,
      latitude,
      longitude,
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
    }),
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

// Materialized travel-summary dashboard (item 14). Reads only the per-identity
// travel_stats rows — the server never scans the raw check-in log here.
export async function fetchStats(): Promise<TravelStats> {
  const res = await fetch(`${API_BASE}/stats`, { credentials: "include" })
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`)
  return res.json()
}

// Every route (start pin → end pin) that has comments, with counts and both
// endpoint pins' names + coordinates — drives the map overlay.
export async function fetchCommentRoutes(): Promise<CommentRoute[]> {
  const res = await fetch(`${API_BASE}/comments/routes`, { credentials: "include" })
  if (!res.ok) throw new Error(`Failed to fetch comment routes: ${res.status}`)
  const data = await res.json()
  return data.routes as CommentRoute[]
}
