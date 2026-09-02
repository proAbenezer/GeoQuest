import { Loader2 } from "lucide-react"

type UnlockResult = {
  unlocked: boolean
  alreadyUnlocked?: boolean
  place?: { id: string; name: string }
  reason?: string
}

type CheckingPlace = { id: string; name: string }

export default function UnlockStatusBanner({
  result,
  error,
  checking,
}: {
  result: UnlockResult | null
  error: string | null
  checking?: CheckingPlace | null
}) {
  if (!result && !error && !checking) return null

  return (
    <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 max-w-[calc(100%-2rem)]">
      {checking && !error && (
        <div className="bg-background/90 backdrop-blur border rounded-lg px-4 py-2 shadow-lg w-full flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <p className="text-sm text-muted-foreground truncate">
            Unlocking {checking.name}…
          </p>
        </div>
      )}
      {result?.unlocked && (
        <div className="bg-background/90 backdrop-blur border rounded-lg px-4 py-2 shadow-lg w-full">
          <p className="text-sm font-semibold truncate">
            {result.alreadyUnlocked ? "Already unlocked: " : "🎉 Unlocked: "}
            <span className="text-primary">{result.place?.name}</span>
          </p>
        </div>
      )}
      {result && !result.unlocked && (
        <div className="bg-background/90 backdrop-blur border rounded-lg px-4 py-2 shadow-lg w-full">
          <p className="text-sm text-muted-foreground truncate">{result.reason}</p>
        </div>
      )}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2 shadow-lg w-full">
          <p className="text-sm text-destructive truncate">{error}</p>
        </div>
      )}
    </div>
  )
}
