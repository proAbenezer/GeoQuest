import { Progress } from "@/components/ui/progress"

const ExploreProgress = ({ title, percent }: { title: string; percent: number | null }) => (
  <div className="space-y-1.5 px-3 py-2 group-data-[collapsible=icon]:hidden">
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="truncate">{title}</span>
      <span className="font-semibold text-foreground tabular-nums">
        {percent === null ? "–" : `${percent}%`}
      </span>
    </div>
    <Progress value={percent ?? 0} className="h-1.5" />
  </div>
)

export default ExploreProgress
