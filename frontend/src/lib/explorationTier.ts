// lib/explorationTier.ts
// Pure derivation of a traveler's exploration LEVEL from their /stats summary —
// a tiered title so someone who has explored a lot is visibly distinct from
// someone who has explored a little. Deliberately no UI here; components render
// the returned shape. Tuning thresholds here changes the whole app in one place.
//
// Score rewards BOTH depth and spread: 1 pt per unlocked place, 2 pts per
// additional country (so crossing borders is meaningful), and ~1 pt per week of
// active days (1/7). The ladder below then maps a score to a title.

export type TierInput = {
  totalPlaces: number
  countriesVisited: number
  totalDays: number
}

export type ExplorerTier = {
  index: number
  name: string
  score: number
  minScore: number
  next: { name: string; minScore: number } | null
  /** 0..1 progress toward the next tier; 1 at the top tier. */
  progress: number
}

const LADDER: { name: string; minScore: number }[] = [
  { name: "Explorer", minScore: 0 },
  { name: "Pathfinder", minScore: 15 },
  { name: "Adventurer", minScore: 40 },
  { name: "Globetrotter", minScore: 90 },
  { name: "World Nomad", minScore: 200 },
]

export function explorationScore(s: TierInput): number {
  const spread = 2 * Math.max(0, s.countriesVisited - 1)
  const activity = Math.floor(s.totalDays / 7)
  return s.totalPlaces + spread + activity
}

export function explorerTier(input: TierInput): ExplorerTier {
  const score = Math.max(0, Math.floor(explorationScore(input)))
  let current = LADDER[0]
  let next: { name: string; minScore: number } | null = null
  for (let i = 0; i < LADDER.length; i++) {
    if (score >= LADDER[i].minScore) {
      current = LADDER[i]
      next = LADDER[i + 1] ?? null
    }
  }
  const progress = next
    ? Math.min(1, (score - current.minScore) / (next.minScore - current.minScore))
    : 1
  return {
    index: LADDER.indexOf(current),
    name: current.name,
    score,
    minScore: current.minScore,
    next,
    progress,
  }
}
