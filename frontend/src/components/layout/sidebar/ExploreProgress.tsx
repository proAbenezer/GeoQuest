import { Progress } from "@/components/ui/progress"

// Percentages are now double precision server-side (a woreda unlock in a big
// region is a real but tiny share, e.g. Oromia 0.5% — no longer truncated to
// integer 0). Print integers above 10, one decimal below so small progress is
// visible but clean, and never a misleading "0%" for a >0 share.
export function formatExplorePercent(percent: number): string {
  if (!Number.isFinite(percent)) return "0%"
  if (percent <= 0) return "0%"
  if (percent >= 100) return "100%"
  if (percent >= 10) return `${Math.round(percent)}%`
  const oneDecimal = Math.max(Math.round(percent * 10) / 10, 0.1)
  return `${oneDecimal}%`
}

const ExploreProgress = ({ title, percent }: { title: string; percent: number | null }) => (
  <div className="space-y-1.5 px-3 py-2 group-data-[collapsible=icon]:hidden">
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      {/* min-w-0 + flex-1 make truncate actually cut long region titles instead
          of letting them push the percentage out of the footer. */}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <span className="shrink-0 font-semibold text-foreground tabular-nums">
        {percent === null ? "–" : formatExplorePercent(percent)}
      </span>
    </div>
    <Progress value={percent ?? 0} className="h-1.5" />
  </div>
)

export default ExploreProgress
