// components/stats/StatPanel.tsx
// Shared glass section panel for the stats dashboard. Mirrors the visual
// language of the app sidebar sections — rounded-xl translucent card with a
// subtle border, an icon chip in the brand tint, and the small uppercase
// section label. Keeps every stats block visually consistent without each
// block re-implementing the wrapper.
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function StatPanel({
  icon: Icon,
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  children,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/40 bg-card/60 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40",
        className
      )}
    >
      <header className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{subtitle}</p>
          )}
        </div>
        {action}
      </header>
      <div className={cn("flex-1 min-h-0", bodyClassName)}>{children}</div>
    </section>
  )
}
