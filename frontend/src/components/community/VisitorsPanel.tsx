// components/community/VisitorsPanel.tsx
// The community block shown inside the map's location panel for a place the
// traveler has unlocked: how many registered users have been here, who the most
// recent ones are, and a Message + Connect (follow) button for each of them.
//
// Signed-in users see names/avatars and can message/connect. Anonymous/guest
// callers get the count and a nudge to sign in — identities stay private
// server-side. Rows are shared PersonRows so "connect" behaves exactly like the
// stats board and Messages → People surfaces.
import { Users, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { usePlaceVisitors } from "@/hooks/usePlaceVisitors"
import { PersonRow } from "@/components/community/PersonRow"

const MAX_VISIBLE = 6

function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export default function VisitorsPanel({ placeId }: { placeId: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { total, visitors, loading } = usePlaceVisitors(placeId)

  const loggedIn = Boolean(user)
  const shown = visitors.slice(0, MAX_VISIBLE)
  const heading =
    total > 0
      ? `${total} ${total === 1 ? "person has" : "people have"} been here`
      : "No one has been here yet"

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        {loading ? "Loading community…" : heading}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !loggedIn ? (
        total > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Sign in to see who's been here and message them.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate("/login")} className="self-start">
              Sign in
            </Button>
          </div>
        )
      ) : shown.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {total === 0
            ? "You're the first to explore here — come back to see who joins you."
            : "No one else has checked in here yet."}
        </p>
      ) : (
        <>
          <ul className="mt-2 flex flex-col divide-y divide-border/40">
            {shown.map((v) => (
              <PersonRow
                key={v.userId}
                compact
                userId={v.userId}
                firstName={v.firstName}
                lastName={v.lastName}
                profileImage={v.profileImage}
                connected={v.connected ?? false}
                subtitle={`visited ${formatDay(v.visitedAt) || "recently"}`}
              />
            ))}
          </ul>
          {visitors.length > MAX_VISIBLE && (
            <p className="pt-1 text-[11px] text-muted-foreground">
              and {visitors.length - MAX_VISIBLE} more
            </p>
          )}
        </>
      )}
    </div>
  )
}
