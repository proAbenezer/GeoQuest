// hooks/useCommentCounts.ts
// Feeds the comment-count badge on pin markers (item 10). Fetches per-pin
// counts for ALL pins (not just the currently-visible viewport-scoped subset),
// keyed only on the set of pin ids — so pan/zoom, which changes which pins are
// rendered, never refetches. A comment added elsewhere stays stale until the
// pin list next changes (add/update/delete), which is fine for a badge.
import { useEffect, useMemo, useState } from "react"
import { fetchCommentCounts } from "@/lib/api"

export function useCommentCounts(pins: { id: string }[]): Record<string, number> {
  const idsKey = useMemo(() => pins.map((p) => p.id).join(","), [pins])
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!idsKey) {
      setCounts({})
      return
    }
    let cancelled = false
    fetchCommentCounts(idsKey.split(","))
      .then((c) => {
        if (!cancelled) setCounts(c)
      })
      .catch(() => {
        // keep previous counts; the next pin-list change retries
      })
    return () => {
      cancelled = true
    }
  }, [idsKey])

  return counts
}
