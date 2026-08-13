import type { Place, UnlockedEntry } from "@/types/places"

export type PlaceState = "locked" | "opened" | "unlocked"

export function placesToGeoJson(places: Place[], unlocked: UnlockedEntry[]) {
  const unlockedSet = new Set(unlocked.map((u) => u.placeId))
  const byId = new Map(places.map((p) => [p.id, p]))
  const childrenOf = new Map<string, string[]>()

  for (const p of places) {
    if (p.parentId) {
      if (!childrenOf.has(p.parentId)) childrenOf.set(p.parentId, [])
      childrenOf.get(p.parentId)!.push(p.id)
    }
  }

  const isLeaf = (id: string) => !childrenOf.has(id) || childrenOf.get(id)!.length === 0
  const state = new Map<string, PlaceState>()

  for (const p of places) {
    if (isLeaf(p.id)) {
      state.set(p.id, unlockedSet.has(p.id) ? "unlocked" : "locked")
    }
  }

  for (const leafId of unlockedSet) {
    let current = byId.get(leafId)
    while (current?.parentId) {
      const parent = byId.get(current.parentId)
      if (!parent) break
      if (state.get(parent.id) !== "unlocked") state.set(parent.id, "opened")
      current = parent
    }
  }

  const maxLevel = Math.max(...places.map((p) => p.adminLevel))
  for (let level = maxLevel; level >= 0; level--) {
    for (const p of places) {
      if (p.adminLevel !== level) continue
      const kids = childrenOf.get(p.id)
      if (!kids || kids.length === 0) continue
      const allUnlocked = kids.every((cid) => state.get(cid) === "unlocked")
      if (allUnlocked) state.set(p.id, "unlocked")
      else if (!state.has(p.id)) state.set(p.id, "locked")
    }
  }

  return {
    type: "FeatureCollection" as const,
    features: places.map((p) => ({
      type: "Feature" as const,
      geometry: JSON.parse(p.boundary),
      properties: {
        id: p.id,
        name: p.name,
        adminLevel: p.adminLevel,
        state: state.get(p.id) ?? "locked",
        isLeaf: isLeaf(p.id), // NEW — lets MapView fill only leaves, outline-only ancestors
      },
    })),
  }
}
