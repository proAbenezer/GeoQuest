import type { ReactNode } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"

interface SidePanelProps {
  children: ReactNode
  className?: string
  widthClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const SidePanel = ({
  children,
  className = "",
  widthClassName = "w-96",
  open = true,
  onOpenChange,
}: SidePanelProps) => {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="!h-[100dvh] w-screen max-w-none rounded-none border-none overflow-y-auto flex flex-col overscroll-contain"
        >
          {children}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className={`side-panel ${widthClassName} bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-l shadow-xl overflow-y-auto ${className}`}
    >
      {children}
    </div>
  )
}

export default SidePanel
