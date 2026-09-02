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

export type Visitor = CommunityProfile & {
  visitedAt: string
  // Logged-in callers also learn whether they follow this visitor.
  connected?: boolean
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
  connected: boolean // I follow them
  followsMe: boolean
}

// Someone I follow — shown in the Messages → People tab.
export type ConnectionUser = CommunityUser & {
  sharedPlaces: number
  followsMe: boolean
}

// A username/name-search hit in the Messages tab.
export type UserSearchResult = CommunityUser & { connected: boolean }
