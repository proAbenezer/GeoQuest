// pages/StatsPage.tsx
// Travel-stats dashboard. Standalone full-width route (ProtectedRoute only —
// no sidebar), restyled to the app's glass/brand language: a sticky top bar
// matching the Navbar, brand-chip hero tiles, and glass StatPanel sections.
//
// Reads the materialized per-user summary from GET /stats and layers on four
// richer panels: a traveler profile band, a per-country region-exploration
// breakdown, a recent-check-ins feed, and a category mix — all derived from
// data the server already exposes (no new schema).
import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  MapPin,
  Globe2,
  CalendarDays,
  Flame,
  RefreshCw,
  Loader2,
  Plane,
  ArrowLeft,
  LogOut,
  User,
  Award,
  MessageCircle,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/context/AuthContext"
import { useUnlockedPlaces } from "@/hooks/useUnlockedPlaces"
import { useVisitedCountriesPlaces } from "@/hooks/useVisitedCountriesPlaces"
import { useTravelStats } from "@/hooks/useTravelStats"
import { useConversationUnread } from "@/hooks/useConversations"
import { explorerTier } from "@/lib/explorationTier"
import { StatPanel } from "@/components/stats/StatPanel"
import WorldMap from "@/components/stats/WorldMap"
import TravelerProfile from "@/components/stats/TravelerProfile"
import RegionExploration from "@/components/stats/RegionExploration"
import RecentCheckins from "@/components/stats/RecentCheckins"
import CategoryMix from "@/components/stats/CategoryMix"
import CoTravelersPanel from "@/components/stats/CoTravelersPanel"
import { formatExplorePercent } from "@/components/layout/sidebar/ExploreProgress"
import type { CountryStat } from "@/types/place"

type SortKey = "places" | "days" | "name"

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

// Hero number tile — brand-chip icon + big tabular numeral + small label,
// echoing the sidebar's section language (rounded-xl translucent card).
function HeroTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string | number
  hint?: string
  icon: typeof MapPin
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none tabular-nums text-foreground">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
        {hint && <p className="truncate text-[11px] text-muted-foreground/70">{hint}</p>}
      </div>
    </div>
  )
}

export default function StatsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refresh } = useTravelStats()
  const unreadMessages = useConversationUnread()
  // The world map shading + region-exploration card share ONE seed of the
  // traveler's cached country trees (driven by their unlock progress).
  const { unlocked } = useUnlockedPlaces()
  const { places } = useVisitedCountriesPlaces(null, unlocked)
  const [sortKey, setSortKey] = useState<SortKey>("places")
  const [sortAsc, setSortAsc] = useState(false)
  // Bumped by the page Refresh button so the co-travelers panel (which reads its
  // own endpoint, not the materialized /stats summary) refetches in step.
  const [coTravelersNonce, setCoTravelersNonce] = useState(0)

  const unlockedIds = useMemo(() => new Set(unlocked.map((u) => u.placeId)), [unlocked])

  // The traveler's exploration level, derived from the materialized summary.
  const level = data
    ? explorerTier({
        totalPlaces: data.summary.totalPlaces,
        countriesVisited: data.summary.countriesVisited,
        totalDays: data.summary.totalDays,
      })
    : null

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : "GQ"

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/login")
    } catch {
      /* stay put on failure */
    }
  }

  const onRefresh = async () => {
    try {
      await refresh()
      setCoTravelersNonce((n) => n + 1)
    } catch {
      /* handled by hook error state */
    }
  }

  const sortedCountries = useMemo(() => {
    if (!data) return []
    const arr = [...data.countries]
    arr.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name)
      return a[sortKey] - b[sortKey]
    })
    if (sortAsc) arr.reverse()
    return arr
  }, [data, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
    >
      {label}
      {sortKey === k && <span className="text-primary">{sortAsc ? "▲" : "▼"}</span>}
    </button>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* ---- Top bar — mirrors the Navbar's sticky glass bar ---- */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border/40 bg-background/90 px-4 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="GeoQuest home">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
            <MapPin className="h-4 w-4" />
          </div>
          <span className="hidden font-heading text-lg font-semibold tracking-tight sm:inline">
            GeoQuest
          </span>
        </Link>
        <span className="hidden h-4 w-px bg-border/60 sm:block" />
        <h1 className="text-sm font-semibold text-foreground">Travel stats</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onRefresh} className="gap-1 text-sm">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Map</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              nativeButton={false}
              render={
                <Avatar className="h-8 w-8 cursor-pointer rounded-lg bg-primary/10 text-primary shadow-sm transition-all hover:bg-primary/20">
                  <AvatarImage src={user?.profileImage} alt={user?.username ?? "Profile"} />
                  <AvatarFallback className="bg-transparent text-primary text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              }
            />
            <DropdownMenuContent
              align="end"
              className="rounded-xl border-border/40 bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60"
            >
              <DropdownMenuItem
                onClick={() => navigate("/messages")}
                className="flex w-full items-center justify-between gap-2 rounded-lg text-sm hover:bg-muted/40"
              >
                <span className="inline-flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" /> Messages
                </span>
                {unreadMessages > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
                    {unreadMessages}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/profile")}
                className="gap-2 rounded-lg text-sm hover:bg-muted/40"
              >
                <User className="h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/40" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="gap-2 rounded-lg text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-6">
        {!data ? (
          <div className="flex min-h-[55vh] items-center justify-center">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : error ? (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button onClick={onRefresh}>Retry</Button>
              </div>
            ) : null}
          </div>
        ) : data.summary.totalPlaces === 0 ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 p-6 text-center">
            <Plane className="h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No travels yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Your travel stats will appear here once you check in somewhere. Head to the map and
              let your location be detected, or tap{" "}
              <span className="font-medium text-foreground">Check in</span>.
            </p>
            <Link to="/">
              <Button>Go to map</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Explorer level */}
            {level && (
              <StatPanel
                icon={Award}
                title="Explorer level"
                subtitle="Your journey level — explore more places, countries, and days to level up"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Award className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold leading-tight text-foreground">
                          {level.name}
                        </p>
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Level {level.index + 1}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Exploration score {level.score}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    {level.next ? (
                      <>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{level.score} pts</span>
                          <span>
                            Next: {level.next.name} · {level.next.minScore}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/80 transition-all duration-500"
                            style={{ width: `${Math.round(level.progress * 100)}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Top tier — no higher level to reach. 🎉
                      </p>
                    )}
                  </div>

                  <div className="grid shrink-0 grid-cols-3 gap-6 sm:gap-8">
                    <div>
                      <p className="text-sm font-bold tabular-nums text-foreground">
                        {data.summary.totalPlaces}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Places</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold tabular-nums text-foreground">
                        {data.summary.countriesVisited}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Countries</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold tabular-nums text-foreground">
                        {data.summary.totalDays}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Active days</p>
                    </div>
                  </div>
                </div>
              </StatPanel>
            )}

            {/* Hero numbers */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HeroTile
                icon={Globe2}
                label="Countries explored"
                value={data.summary.countriesVisited}
              />
              <HeroTile icon={MapPin} label="Places unlocked" value={data.summary.totalPlaces} />
              <HeroTile
                icon={CalendarDays}
                label="Active days"
                value={data.summary.totalDays}
                hint={`${formatDate(data.summary.firstVisitAt)} – ${formatDate(data.summary.lastVisitAt)}`}
              />
              <HeroTile
                icon={Flame}
                label={data.streak ? `Longest streak · ${data.streak.name}` : "Longest streak"}
                value={data.streak ? `${data.streak.longestDays}d` : "—"}
              />
            </div>

            {/* Traveler profile band */}
            <TravelerProfile summary={data.summary} countries={data.countries} />

            {/* People who've been where the traveler has */}
            <CoTravelersPanel key={coTravelersNonce} />

            {/* World + region exploration */}
            <div className="grid gap-5 lg:grid-cols-5">
              <StatPanel
                icon={Globe2}
                title="World"
                subtitle={`${data.countries.length} countr${data.countries.length === 1 ? "y" : "ies"} visited`}
                className="h-full lg:col-span-3"
                bodyClassName="flex flex-col"
              >
                <div className="relative min-h-[16rem] flex-1 overflow-hidden rounded-xl border border-border/40">
                  <div className="absolute inset-0">
                    <WorldMap places={places} />
                  </div>
                </div>
              </StatPanel>
              {data.countries.length > 0 && (
                <div className="h-full lg:col-span-2">
                  <RegionExploration
                    countries={data.countries}
                    unlockedIds={unlockedIds}
                    places={places}
                  />
                </div>
              )}
            </div>

            {/* Recent activity + category mix */}
            <div className="grid gap-5 lg:grid-cols-2">
              <RecentCheckins />
              <CategoryMix categories={data.categories} />
            </div>

            {/* Sortable per-country breakdown */}
            <StatPanel
              icon={MapPin}
              title="All countries"
              subtitle="Sorted by places — tap a column header to reorder"
              action={
                <Button variant="ghost" size="sm" onClick={onRefresh} className="gap-1 text-xs">
                  <RefreshCw className="h-3 w-3" /> Refresh
                </Button>
              }
            >
              <div className="overflow-x-auto rounded-lg border border-border/40">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-left">
                      <th className="px-4 py-2.5">
                        <SortHeader label="Country" k="name" />
                      </th>
                      <th className="px-4 py-2.5 text-right">
                        <SortHeader label="Places" k="places" />
                      </th>
                      <th className="px-4 py-2.5 text-right">
                        <SortHeader label="Days" k="days" />
                      </th>
                      <th className="px-4 py-2.5 text-right">Explored</th>
                      <th className="px-4 py-2.5 text-right">First visit</th>
                      <th className="px-4 py-2.5 text-right">Last visit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCountries.map((c: CountryStat) => (
                      <tr key={c.iso2} className="border-b border-border/40 last:border-0">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-foreground">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.continent ?? c.iso2}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{c.places}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{c.days}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {c.explorationPercent != null
                            ? formatExplorePercent(c.explorationPercent)
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">
                          {formatDate(c.firstVisitAt)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">
                          {formatDate(c.lastVisitAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </StatPanel>
          </>
        )}
      </div>
    </div>
  )
}
