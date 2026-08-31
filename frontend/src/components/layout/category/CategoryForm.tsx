import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { IconMultiSelect } from "@/components/ui/icon-multi-select"
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

type Props = {
  name: string
  setName: (v: string) => void
  description: string
  setDescription: (v: string) => void
  icons: string[]
  setIcons: (v: string[]) => void
  onSubmit: () => void
}

type MatchResult = {
  canonicalId: string
  confidence: "exact" | "fuzzy"
} | null

const CategoryForm = ({
  name,
  setName,
  description,
  setDescription,
  icons,
  setIcons,
  onSubmit,
}: Props) => {
  const [match, setMatch] = useState<MatchResult>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced fetch for match
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    if (name.trim().length < 2) {
      setMatch(null)
      setMatchLoading(false)
      return
    }

    setMatchLoading(true)
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/categories/match?name=${encodeURIComponent(name.trim())}`,
          { credentials: "include" }
        )
        if (!res.ok) {
          throw new Error("Failed to fetch match")
        }
        const data = await res.json()
        setMatch(data.match) // { canonicalId, confidence } or null
      } catch (err) {
        console.error("Match fetch error:", err)
        setMatch(null)
      } finally {
        setMatchLoading(false)
      }
    }, 400)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [name])

  return (
    <div className="space-y-3 border-b px-5 py-4">
      <div className="space-y-2">
        <Label>Category Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Coffee Shops"
        />
        {/* Match preview */}
        {name.trim().length >= 2 && (
          <div className="flex items-center gap-2 text-xs">
            {matchLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Matching...</span>
              </>
            ) : match ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span className="text-muted-foreground">
                  Maps to:{" "}
                  <span className="font-medium text-foreground">
                    {match.canonicalId}
                  </span>
                  {match.confidence === "fuzzy" && (
                    <span className="text-yellow-600"> (fuzzy match)</span>
                  )}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  No Mapbox match found
                </span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional"
        />
      </div>
      <div className="space-y-2">
        <Label>Icons</Label>
        <IconMultiSelect value={icons} onChange={setIcons} />
      </div>
      <Button onClick={onSubmit} className="w-full">
        Add Category
      </Button>
    </div>
  )
}

export default CategoryForm
