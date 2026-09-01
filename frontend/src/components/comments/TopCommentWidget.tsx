// components/comments/TopCommentWidget.tsx
// Phase 2 — the bottom-right community widget. Watches the map viewport center
// and shows the single most-upvoted comment at the comment-bearing location
// nearest the current view. "Next" steps through that SAME location's other
// comments in descending vote order; it never jumps to a different location.
// Clicking the card opens a side panel with the full threaded section.
import { useEffect, useRef, useState } from "react"
import {
  ChevronRight,
  MapPin,
  MessageSquare,
  ThumbsUp,
  X,
} from "lucide-react"
import type { CommentTarget, RelevantCommentResult } from "@/types"
import { usePins } from "@/context/usePins"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import SidePanel from "@/components/layout/sidebar/SidePanel"
import CommentSection, { timeAgo, initialsOf } from "@/components/comments/CommentSection"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

// A stable identity for a target so we can tell "the map moved to a new
// location" (reset the stepping index) from "same location, refresh" (keep it).
function targetKey(t: (CommentTarget & { name: string }) | null): string {
  if (!t) return ""
  if (t.type === "pin") return `pin:${t.pinId}`
  if (t.type === "location") return `loc:${t.placeId}`
  return `route:${t.routeStartPinId}:${t.routeEndPinId}`
}

export default function TopCommentWidget() {
  const { viewportCenter, commentViewOpen, openCommentView, selectedRoute } = usePins()
  const [result, setResult] = useState<RelevantCommentResult>({ target: null, comments: [] })
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const currentKeyRef = useRef<string>("")

  // The widget's feed is either the selected route (user clicked a path — show
  // that route's comments) or the nearest comment-bearing location to the
  // viewport center. Route selection wins while it's set; deselecting the
  // route reverts to the viewport-based feed.
  useEffect(() => {
    if (selectedRoute) {
      let cancelled = false
      setLoading(true)
      const params = new URLSearchParams({
        routeStartPinId: selectedRoute.routeStartPinId,
        routeEndPinId: selectedRoute.routeEndPinId,
      })
      fetch(`${API_BASE}/comments/relevant?${params}`, { credentials: "include" })
        .then((response) => response.json())
        .then((data: RelevantCommentResult) => {
          if (cancelled) return
          const key = targetKey(data.target)
          if (key !== currentKeyRef.current) {
            // Different target — restart from its top comment and bring the
            // widget back if it was dismissed.
            currentKeyRef.current = key
            setIndex(0)
            setDismissed(false)
            openCommentView(false)
          }
          setResult(data)
        })
        .catch((err) => console.error("Failed to load route comments:", err))
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }

    if (!viewportCenter) return
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `${API_BASE}/comments/relevant?lat=${viewportCenter.latitude}&lng=${viewportCenter.longitude}`,
          { credentials: "include" }
        )
        const data: RelevantCommentResult & { error?: string } = await response.json()
        if (!response.ok) throw new Error(data.error ?? "Failed to load comments")

        const key = targetKey(data.target)
        if (key !== currentKeyRef.current) {
          // Moved to a different location — restart from its top comment and
          // bring the widget back if it was dismissed.
          currentKeyRef.current = key
          setIndex(0)
          setDismissed(false)
          openCommentView(false)
        }
        setResult(data)
      } catch (err) {
        console.error("Failed to load relevant comments:", err)
      } finally {
        setLoading(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [selectedRoute, viewportCenter?.latitude, viewportCenter?.longitude, openCommentView])

  const { target, comments } = result
  const total = comments.length
  const safeIndex = total > 0 ? Math.min(index, total - 1) : 0
  const comment = comments[safeIndex]

  if (!target || !comment) return null

  // Dismissed — show only a small floating toggle so the widget can be
  // reopened. It stays visible until tapped (persists; the debounced effect
  // above only auto-reopens it when the viewport moves to a new location).
  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        className="absolute bottom-20 right-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-colors hover:bg-muted/40 sm:bottom-6 sm:right-4"
        aria-label="Show community comments"
        title="Community comments"
      >
        <MessageSquare className="h-4 w-4 text-primary" />
      </button>
    )
  }

  return (
    <>
      {/* bottom-20 on small screens lifts the card clear of the bottom-right
          info/attribution area; bottom-6 on sm+ restores the desktop position. */}
      <div className="absolute bottom-20 right-3 z-30 w-72 max-w-[calc(100vw-2rem)] sm:bottom-6 sm:right-4">
        <div
          className={`rounded-xl border border-border/60 bg-background/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/80 overflow-hidden ${
            loading ? "opacity-70" : ""
          }`}
        >
          {/* Header — location name + dismiss */}
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {target.name}
            </span>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Hide widget"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Body — top comment; click opens the full section */}
          <button
            type="button"
            onClick={() => openCommentView(true)}
            className="block w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
            title="View all comments here"
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5 rounded-full">
                <AvatarImage src={comment.author.profileImage || undefined} alt={comment.author.firstName} />
                <AvatarFallback className="text-[9px] font-medium">{initialsOf(comment)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-xs font-medium">
                {`${comment.author.firstName} ${comment.author.lastName}`}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(comment.createdAt)}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-foreground/90">{comment.body}</p>
          </button>

          {/* Footer — votes + Next stepping (same location only) */}
          <div className="flex items-center justify-between border-t border-border/40 px-2 py-1.5">
            <span className="flex items-center gap-1 px-2 text-[11px] font-semibold tabular-nums text-muted-foreground">
              <ThumbsUp className="h-3 w-3" />
              {comment.netVotes}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openCommentView(true)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MessageSquare className="h-3 w-3" /> View all
              </button>
              {total > 1 && (
                <>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {safeIndex + 1}/{total}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIndex((i) => (i + 1) % total)}
                    className="flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View-more side panel, reusing the threaded CommentSection */}
      {commentViewOpen && target && (
        <SidePanel widthClassName="w-[28rem]" onOpenChange={(open) => openCommentView(open)}>
          <div className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block font-heading text-lg font-semibold tracking-tight">
                    Community comments
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{target.name}</span>
                </div>
              </div>
              <button
                onClick={() => openCommentView(false)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="px-3 py-4">
            <CommentSection target={target} />
          </div>
        </SidePanel>
      )}
    </>
  )
}
