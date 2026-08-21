import { toast } from "sonner"
import { Lock } from "lucide-react"

export function notifyLocked(message: string) {
  const title = message || "Location is locked"

  toast(title, {
    icon: <Lock className="h-5 w-5 text-muted-foreground/70" />,
    description: "Unlock this country to add pins and see details.",
    duration: 5000,
    position: "top-right",
    className: "!bg-card/95 !border !border-border/40 !text-foreground !shadow-xl !rounded-xl !backdrop-blur supports-[backdrop-filter]:!bg-card/90 !p-4",
  })
}

export { toast }
