type UnlockResult = {
  unlocked: boolean
  alreadyUnlocked?: boolean
  place?: { id: string; name: string }
  reason?: string
}

export default function UnlockStatusBanner({
  result,
  error,
}: {
  result: UnlockResult | null
  error: string | null
}) {
  if (!result && !error) return null

  return (
    <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 max-w-[calc(100%-2rem)]">
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
