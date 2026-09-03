// types/community.ts
// DTO shapes for the community layer (per-place visitors, private DMs, and
// connections/co-travelers). Mirrors the responses of
// server/src/routes/community.ts exactly.

export type CommunityProfile = {
  userId: string
  firstName: string
  lastName: string
  profileImage: string | null
}

// Where I stand with another user, derived server-side from the 1–2 connection
// rows between us: `connected` means we've accepted each other (both directions
// accepted — the state that unlocks DMs), `incomingPending` means they've asked
// me, `outgoingPending` means I've asked them. `following` is the one-way
// subscription (Instagram-style) that grants me their public content even
// without a connection.
export type RelationState = {
  connected: boolean
  incomingPending: boolean
  outgoingPending: boolean
  following: boolean
}

export type Visitor = CommunityProfile & {
  visitedAt: string
  // Relation flags present only for logged-in callers (visitor identities are
  // private otherwise).
  connected?: boolean
  incomingPending?: boolean
  outgoingPending?: boolean
}

export type PlaceVisitors = {
  total: number
  // Present only when the caller is logged in — visitor identities are private.
  visitors?: Visitor[]
}

export type LastMessage = {
  id: string
  body: string
  authorUserId: string
  createdAt: string
}

export type ConversationSummary = {
  id: string
  withUser: CommunityProfile | null
  updatedAt: string
  lastMessage: LastMessage | null
  unreadCount: number
}

export type ChatMessage = LastMessage & { conversationId: string }

// ---- Connections / co-travelers / user search ----

// A registered user surfaced in the community (has a username).
export type CommunityUser = CommunityProfile & { username: string }

// Someone I've crossed paths with (shared >=1 unlocked place) on the stats board.
export type FellowTraveler = CommunityUser & {
  sharedPlaces: number
  lastSharedAt: string | null
} & RelationState

// Someone I'm connected to — shown in the Messages → People tab.
export type ConnectionUser = CommunityUser & {
  sharedPlaces: number
  connected: true
}

// An open request — either someone asking me (incoming) or someone I've asked
// (outgoing). Both come back from GET /community/connections/pending.
export type PendingConnection = CommunityUser & RelationState

// A username/name-search hit in the Messages tab.
export type UserSearchResult = CommunityUser & RelationState

// ---- In-app notifications (server/src/routes/notifications.ts) ----

export type NotificationType =
  | "connection_request"
  | "connection_accepted"
  | "comment_vote"
  | "comment"
  | "place_unlock"
  | "message"
  | "follow"
  | "group_added"
  | "group_message"

export type NotificationRow = {
  id: string
  type: NotificationType
  /** Comment id | place id | pin id | conversation id | group id — the event's target. */
  refId: string | null
  /** Snippet shown in the popup (place name, trimmed comment body, group name …). */
  context: string | null
  createdAt: string
  readAt: string | null
  actor: CommunityProfile | null
}

// ---- Public profiles (server/src/routes/user.ts GET /user/:userId) ----

// Travel KPIs for a registered traveler — the same fold the owner sees on their
// own /stats, surfaced on the public profile (server/src/routes/stats.ts).
export type TravelKpis = {
  countriesVisited: number
  totalPlaces: number
  totalDays: number
  firstVisitAt: string | null
  lastVisitAt: string | null
  longestStreakDays: number
  streakCountry: string | null
}

export type PublicProfileUser = {
  id: string
  username: string
  firstName: string
  lastName: string
  profileImage: string | null
  createdAt: string
}

export type PublicProfileBundle = {
  user: PublicProfileUser
  // RelationState from the CALLER's perspective plus whether this user follows
  // the caller back.
  relation: RelationState & { followsYou: boolean }
  followersCount: number
  followingCount: number
  stats: TravelKpis
}

// ---- Public pins feed (server/src/routes/pins.ts GET /pins/public) ----
// The audience feed powering BOTH the map overlay and a profile's gallery. Only
// pins owned by users I'm connected to or follow are returned (guests get none).

export type PublicPinOwner = CommunityProfile & { username: string }

// A slim public pin (subset of Pin) with the owner stamped on. Matches the
// flattened server row: `{ ...pinColumns, owner }`.
export type PublicPin = {
  id: string
  name: string
  customName: string | null
  description: string
  latitude: number
  longitude: number
  categoryId: string | null
  placeId: string
  visitDate: string | null
  imageUrl: string | null
  icons: string[] | null
  saved: boolean | null
  visibility: "public" | "private"
  createdAt: string
  owner: PublicPinOwner
}

export type PublicPinsFeed = {
  pins: PublicPin[]
  // A public route = a comment target spanning two of the owner's pins whose
  // endpoints are both public + visible; renders as a line between markers.
  routePairs: { startPinId: string; endPinId: string }[]
}

// ---- Co-traveler groups (server/src/routes/groups.ts, mounted /groups) ----

// A group message carries its author's profile (joined server-side) so sender
// names survive a member leaving/being removed.
export type GroupMessage = {
  id: string
  groupId: string
  authorUserId: string
  body: string
  createdAt: string
  author: CommunityProfile
}

// The place a group is linked to — the creator's own public pin. Shown to every
// member as a card they can open on the map (members are often direct-added and
// don't otherwise follow the creator). Rides beside a group, never inside it.
export type LinkedGroupPin = {
  id: string
  name: string
  imageUrl: string | null
  latitude: number
  longitude: number
}

export type GroupSummary = {
  id: string
  name: string
  imageUrl: string | null
  createdBy: CommunityProfile | null
  mine: boolean
  memberCount: number
  lastMessage: GroupMessage | null
  unreadCount: number
  updatedAt: string
}

export type GroupChatThread = {
  group: {
    id: string
    name: string
    imageUrl: string | null
    createdBy: CommunityProfile | null
    createdByUserId: string
    mine: boolean
    memberCount: number
    updatedAt: string
  }
  pin: LinkedGroupPin | null
  members: CommunityProfile[]
  messages: GroupMessage[]
}
