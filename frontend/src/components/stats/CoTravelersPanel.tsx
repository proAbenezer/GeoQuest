// components/stats/CoTravelersPanel.tsx
// "Travelers you've crossed paths with" — people who have unlocked at least one
// place the current traveler has too, most places in common first. Each row can
// Message, Connect, or open their public profile. A "+ New group" action opens
// the Messages group-creation page (/messages/new-group) pre-selecting the
// co-travelers shown here; the actual group is built there (name, photo, linked
// place, members) and lands you in its chat. Placed on the stats dashboard after
// the traveler-profile band; it reads its own data (GET /community/co-travelers)
// so it stays independent of the materialized /stats summary.
import { useNavigate, Link } from "react-router-dom"
import { Users, Loader2, MapPin, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatPanel } from "@/components/stats/StatPanel"
import { PersonRow } from "@/components/community/PersonRow"
import { useCoTravelers } from "@/hooks/useConnections"
import type { FellowTraveler } from "@/types/community"

const MAX_VISIBLE = 8

function subtitleFor(t: FellowTraveler): string {
  const parts: string[] = []
  if (t.sharedPlaces > 0) {
    parts.push(`${t.sharedPlaces} place${t.sharedPlaces === 1 ? "" : "s"} in common`)
  }
  if (t.incomingPending) parts.push("wants to connect")
  return parts.join(" · ")
}

export default function CoTravelersPanel() {
  const { travelers, loading } = useCoTravelers()
  const navigate = useNavigate()

  const openNewGroup = () => {
    // Pre-select the co-travelers shown here so "start a trip together" is one
    // tap away; anyone can be removed on the next screen.
    navigate("/messages/new-group", {
      state: { travelers: travelers.slice(0, MAX_VISIBLE) },
    })
  }

  const shown = travelers.slice(0, MAX_VISIBLE)

  return (
    <StatPanel
      icon={Users}
      title="Travelers you've crossed paths with"
      subtitle={
        travelers.length > 0
          ? "People who've checked in somewhere you have"
          : "People who've been to the same places as you"
      }
      action={
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {travelers.length > MAX_VISIBLE && (
            <Link
              to="/messages"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              View all in Messages →
            </Link>
          )}
          <Button size="sm" variant="outline" onClick={openNewGroup} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            New group
          </Button>
        </div>
      }
    >
      {loading && travelers.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-muted-foreground">
            No one's crossed your path yet. Check in at more places and travelers
            who've been there too will show up here.
          </p>
          <Link to="/">
            <Button size="sm" className="gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Explore the map
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border/40">
            {shown.map((t) => (
              <PersonRow
                key={t.userId}
                userId={t.userId}
                firstName={t.firstName}
                lastName={t.lastName}
                username={t.username}
                profileImage={t.profileImage}
                connected={t.connected}
                incomingPending={t.incomingPending}
                outgoingPending={t.outgoingPending}
                subtitle={subtitleFor(t)}
              />
            ))}
          </ul>
          {travelers.length > MAX_VISIBLE && (
            <p className="pt-1 text-[11px] text-muted-foreground">
              and {travelers.length - MAX_VISIBLE} more — view them in Messages
            </p>
          )}
        </>
      )}
    </StatPanel>
  )
}
