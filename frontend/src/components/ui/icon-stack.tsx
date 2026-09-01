// components/ui/icon-stack.tsx
import type { LucideIcon } from "lucide-react"

interface IconStackProps {
  icons: LucideIcon[]
  size?: string
  max?: number
  className?: string
}

/**
 * Renders a cluster of icons, overlapping slightly, so multi-icon pins and
 * categories display gracefully in tight spaces. Icons are deliberately
 * transparent — no chip or circle behind them — so the artwork reads on any
 * background. Colors inherit from the parent via currentColor; overflow icons
 * collapse into a "+N" label.
 */
export function IconStack({
  icons,
  size = "h-4 w-4",
  max = 3,
  className = "",
}: IconStackProps) {
  if (icons.length === 0) return null
  const shown = icons.slice(0, max)
  const extra = icons.length - shown.length
  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className="inline-flex items-center -space-x-1.5">
        {shown.map((Icon, i) => (
          <Icon key={i} className={size} />
        ))}
      </span>
      {extra > 0 && (
        <span className="ml-1 text-[10px] font-medium text-muted-foreground">
          +{extra}
        </span>
      )}
    </span>
  )
}
