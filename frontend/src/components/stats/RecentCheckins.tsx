// components/stats/RecentCheckins.tsx
// Latest check-ins feed. The main app surfaces this through useRecentlyVisited,
// but that hook needs PinsProvider — /stats is a standalone route without it,
// so this card fetches the same GET /recently-visited endpoint directly and
// renders the most recent handful. Unlocked-place check-ins get the brand chip;
// manual pins get the bookmark chip.
import { useEffect, useState } from "react"
import { History, MapPin, Bookmark, Loader2 } from "lucide-react"
import { StatPanel } from "./StatPanel"
import type { RecentlyVisitedItem } from "@/hooks/useRecentlyVisited"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export default function RecentCheckins({ limit = 6 }: { limit?: number }) {
  const [items, setItems] = useState<RecentlyVisitedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${API_BASE}/recently-visited`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load recently visited: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setItems(data.items || [])
      })
      .catch(() => {
        /* offline/unauth — the panel just stays quiet */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const shown = items.slice(0, limit)

  return (
    <StatPanel
      icon={History}
      title="Recent check-ins"
      subtitle={loading ? "Loading…" : shown.length ? "Your latest places" : "No activity yet"}
      className="h-full"
    >
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Check in somewhere to start your timeline.
        </p>
      ) : (
        <ol className="flex flex-col">
          {shown.map((item, i) => (
            <li
              key={item.id}
              className={`flex items-center gap-3 py-2.5 ${
                i !== shown.length - 1 ? "border-b border-border/40" : ""
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  item.type === "unlocked"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/40 text-muted-foreground"
                }`}
              >
                {item.type === "unlocked" ? (
                  <MapPin className="h-4 w-4" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                {item.address && (
                  <p className="truncate text-xs text-muted-foreground/70">{item.address}</p>
                )}
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatDate(item.visitedAt)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </StatPanel>
  )
}
