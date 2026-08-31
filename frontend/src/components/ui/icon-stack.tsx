// components/ui/icon-stack.tsx
import type { LucideIcon } from "lucide-react"

interface IconStackProps {
  icons: LucideIcon[]
  size?: string
  max?: number
  className?: string
}

/**
 * Renders a cluster of icons as overlapping rounded chips so multi-icon pins
 * and categories display gracefully in tight spaces. Colors inherit from the
 * parent via currentColor; overflow icons collapse into a "+N" chip.
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
    <span className={`inline-flex items-center -space-x-1.5 ${className}`}>
      {shown.map((Icon, i) => (
        <span
          key={i}
          className="flex items-center justify-center rounded-full bg-background ring-1 ring-border shadow-sm"
        >
          <Icon className={size} />
        </span>
      ))}
      {extra > 0 && (
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
          +{extra}
        </span>
      )}
    </span>
  )
}
