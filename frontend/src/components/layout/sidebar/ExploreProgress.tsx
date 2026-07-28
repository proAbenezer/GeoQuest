import { Progress } from "@/components/ui/progress"

const ExploreProgress = ({ percent }: { percent: number }) => (
  <div className="space-y-1.5 px-3 py-2 group-data-[collapsible=icon]:hidden">
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>Addis Ababa Explored</span>
      <span className="font-semibold text-foreground">{percent}%</span>
    </div>
    <Progress value={percent} className="h-1.5" />
  </div>
)

export default ExploreProgress
