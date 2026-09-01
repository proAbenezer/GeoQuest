import { Progress } from "@/components/ui/progress"

const ExploreProgress = ({ title, percent }: { title: string; percent: number | null }) => (
  <div className="space-y-1.5 px-3 py-2 group-data-[collapsible=icon]:hidden">
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      {/* min-w-0 + flex-1 make truncate actually cut long region titles instead
          of letting them push the percentage out of the footer. */}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <span className="shrink-0 font-semibold text-foreground tabular-nums">
        {percent === null ? "–" : `${percent}%`}
      </span>
    </div>
    <Progress value={percent ?? 0} className="h-1.5" />
  </div>
)

export default ExploreProgress
