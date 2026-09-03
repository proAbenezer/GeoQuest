// db/schema.ts
import {
  pgTable,
  uuid,
  text,
  boolean,
  doublePrecision,
  timestamp,
  date,
  integer,
  customType,
  uniqueIndex,
  index,
  AnyPgColumn
} from "drizzle-orm/pg-core"
import { relations, sql } from "drizzle-orm"

const multiPolygon = customType<{ data: string }>({
  dataType() {
    return "geometry(MultiPolygon,4326)"
  },
})

// --- USERS & GUESTS ---
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  profileImage: text("profile_image"),
  bannerImage: text("banner_image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const guests = pgTable("guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// db/schema.ts
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestId: uuid("guest_id").references(() => guests.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  mapboxCategory: text("mapbox_category"),
  mapboxCategoryConfidence: text("mapbox_category_confidence"),
  icons: text("icons").array().notNull().default(sql`'{}'::text[]`),
})

// --- GEOGRAPHIC HIERARCHY (UNIFIED PLACES) ---
export const places = pgTable("places", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  adminLevel: integer("admin_level").notNull(),
  levelType: text("level_type").notNull(),
  parentId: uuid("parent_id").references((): AnyPgColumn => places.id, {
    onDelete: "cascade",
  }),
  countryCode: text("country_code").notNull(),
  shapeId: text("shape_id").unique(),
  boundary: multiPolygon("boundary"),
  // Precomputed geographic area (m² via ST_Area(boundary::geography)) used to
  // weight the exploration roll-up by real coverage instead of child count.
  // Null until backfilled; the roll-up falls back to count-weighting then.
  area: doublePrecision("area"),
})

// --- COUNTRY FETCH / CACHE STATUS ---
export const countryFetchStatus = pgTable("country_fetch_status", {
  countryCode: text("country_code").primaryKey(),
  status: text("status").notNull().default("not_cached"),
  requestedAt: timestamp("requested_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
})

// --- UNLOCKED PROGRESS ---
export const unlockedPlaces = pgTable(
  "unlocked_places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
    // Minutes to ADD to UTC to get the traveler's local time at check-in (east
    // positive: Ethiopia = +180). Sent by the client (JS getTimezoneOffset(),
    // negated) and drives the "distinct calendar day" buckets in travel_stats.
    // Null for legacy rows → treated as 0 (UTC).
    timezoneOffsetMinutes: integer("timezone_offset_minutes"),
    lastAccessedAt: timestamp("last_accessed_at").notNull().defaultNow(),
    isPinned: boolean("is_pinned").default(false),
    pinId: uuid("pin_id").references(() => pins.id, { onDelete: "set null" }),
  },
  (table) => ({
    uniqueUserUnlock: uniqueIndex("unique_user_unlock")
      .on(table.placeId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    uniqueGuestUnlock: uniqueIndex("unique_guest_unlock")
      .on(table.placeId, table.guestId)
      .where(sql`${table.guestId} IS NOT NULL`),
  })
)

// --- EXPLORATION ROLL-UP (derived, persisted per identity) ---
// The unlock logic decides which LEAF divisions a user has physically visited
// (that is `unlockedPlaces` above). A place's "explored" flag and percentage are
// the bottom-up roll-up of those leaves: a parent is fully explored when every
// direct child is explored, and percent is the AREA-WEIGHTED AVERAGE of the
// children's percents — a partially-explored child (a zone at 6%) rolls its 6%
// up to its parent scaled by its area, instead of contributing nothing until
// fully explored. Double precision, so a real but tiny share (Oromia at ~0.5%
// after one woreda) isn't truncated to integer 0. These rows are recomputed and
// persisted at write time (POST /places/unlock) so reads never rebuild the
// hierarchy. Stored per identity (user or guest), keyed exactly like
// `unlockedPlaces`.
export const placeExploration = pgTable(
  "place_exploration",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "cascade" }),
    explored: boolean("explored").notNull().default(false),
    percent: doublePrecision("percent").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueUserExploration: uniqueIndex("unique_user_exploration")
      .on(table.placeId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    uniqueGuestExploration: uniqueIndex("unique_guest_exploration")
      .on(table.placeId, table.guestId)
      .where(sql`${table.guestId} IS NOT NULL`),
  })
)

// --- TRAVEL STATS (materialized per-user summary, updated incrementally) ---
// One row per identity × country, updated at write time on each check-in
// (POST /places/unlock) — the dashboard reads ONLY these rows, never the raw
// check-in log. `days` holds the distinct LOCAL calendar days (YYYYMMDD ints)
// that had a check-in; country attribution comes from the places hierarchy via
// the leaf's countryCode + root name. Legacy identities with unlocks but no
// rows are backfilled lazily on first GET /stats.
export const travelStats = pgTable(
  "travel_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "cascade" }),
    countryCode: text("country_code").notNull(),
    countryName: text("country_name").notNull(),
    placesCount: integer("places_count").notNull().default(0),
    days: integer("days").array().notNull().default(sql`'{}'::integer[]`),
    firstVisitAt: timestamp("first_visit_at"),
    lastVisitAt: timestamp("last_visit_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueUserCountry: uniqueIndex("unique_user_country")
      .on(table.userId, table.countryCode)
      .where(sql`${table.userId} IS NOT NULL`),
    uniqueGuestCountry: uniqueIndex("unique_guest_country")
      .on(table.countryCode, table.guestId)
      .where(sql`${table.guestId} IS NOT NULL`),
  })
)

// --- PINS ---
export const pins = pgTable(
  "pins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    placeId: uuid("place_id").references(() => places.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    customName: text("custom_name"),
    description: text("description").notNull(),
    customDescription: text("custom_description"),
    notes: text("notes"),
    visitDate: date("visit_date"),
    visited: boolean("visited").notNull().default(false),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    imageUrl: text("image_url"),
    saved: boolean("saved").default(false),
    icons: text("icons").array().notNull().default(sql`'{}'::text[]`),
    // Community visibility: 'public' pins/routes can be seen + commented by the
    // owner's connections and followers only; 'private' stays owner-only.
    visibility: text("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("private"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // The public feed (GET /pins/public) scans public pins by owner.
    ownerPublicIdx: index("pins_owner_public_idx")
      .on(table.userId)
      .where(sql`${table.visibility} = 'public'`),
  })
)

// --- FOLLOWS (one-way subscription between registered users) ---
// A row means `followerId` follows `followeeId` to see their public pins/routes.
// Unlike connections there is no request/accept: following is instant and
// unilateral (Instagram-style). Connections stay the stronger, reciprocal
// "friends" relation; follow is how anyone subscribes to someone's public content.
export const follows = pgTable(
  "follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: uuid("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueFollow: uniqueIndex("unique_follow").on(table.followerId, table.followeeId),
    // "Who follows me" lookups (follower counts, follower lists).
    followeeIdx: index("follows_followee_idx").on(table.followeeId),
  })
)

// --- COMMUNITY GROUPS (Telegram-style chat between registered users) ---
// A group is created by one user (createdByUserId); membership is direct-add
// (no accept) — anyone the creator adds becomes a member and can leave whenever.
// Unread tracking per member mirrors conversationParticipants.lastReadAt.
export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Group "profile": an avatar photo shown wherever the group is listed.
  imageUrl: text("image_url"),
  // Optional linked place — a public pin of the creator the group is about.
  // Members see it on the chat header and the map. ON DELETE SET NULL: if the
  // pin is deleted the group just stops referencing it.
  pinId: uuid("pin_id").references(() => pins.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueGroupMember: uniqueIndex("unique_group_member").on(table.groupId, table.userId),
    // "Which groups am I in" lookups (the inbox list).
    memberUserIdIdx: index("group_members_user_idx").on(table.userId),
  })
)

export const groupMessages = pgTable(
  "group_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    groupMessageIdx: index("group_message_idx").on(table.groupId, table.createdAt),
  })
)

// --- RECENTLY VISITED ---
export const recentlyVisited = pgTable(
  "recently_visited",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    firstVisitedAt: timestamp("first_visited_at").notNull().defaultNow(),
    lastAccessedAt: timestamp("last_accessed_at").notNull().defaultNow(),
    isPinned: boolean("is_pinned").default(false),
    pinId: uuid("pin_id").references(() => pins.id, { onDelete: "set null" }),
    visitCount: integer("visit_count").default(1),
    autoTracked: boolean("auto_tracked").default(true),
  },
  (table) => ({
    uniqueUserPlace: uniqueIndex("unique_user_place")
      .on(table.placeId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    uniqueGuestPlace: uniqueIndex("unique_guest_place")
      .on(table.placeId, table.guestId)
      .where(sql`${table.guestId} IS NOT NULL`),
  })
)

// --- COMMUNITY COMMENTS ---
// Comments are community content: any logged-in user can write/vote, everyone
// (guests included) can read. No guest ownership columns — guest sessions can
// only view. Latitude/longitude are snapshots taken at creation so the Phase 2
// widget can find the nearest comment-bearing location without re-resolving targets.
export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  body: text("body").notNull(),
  // Optional photo on a route post: a route isn't its own table — it's the
  // comment thread over a start→end pin pair — so the photo rides the comment
  // that starts the route conversation. Pins keep their own image_url; this
  // column only ever gets set for route-target comments.
  imageUrl: text("image_url"),
  parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, {
    onDelete: "cascade",
  }),
  targetType: text("target_type", { enum: ["pin", "location", "route"] }).notNull(),
  pinId: uuid("pin_id").references(() => pins.id, { onDelete: "cascade" }),
  placeId: uuid("place_id").references(() => places.id, { onDelete: "cascade" }),
  routeStartPinId: uuid("route_start_pin_id").references(() => pins.id, { onDelete: "cascade" }),
  routeEndPinId: uuid("route_end_pin_id").references(() => pins.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const commentVotes = pgTable(
  "comment_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: integer("value").notNull(), // 1 (up) | -1 (down)
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueVotePerUser: uniqueIndex("unique_vote_per_user").on(
      table.commentId,
      table.userId
    ),
  })
)

// ============================================
// ============================================
// PRIVATE MESSAGING (1:1 DMs between registered users)
// ============================================
// Conversations are shared threads; users join them through
// conversationParticipants (a 1:1 DM = exactly two participant rows). Guests
// can never participate — the chat routes are gated behind requireAuth only.
// lastReadAt on a participant tracks how far they've read, so unread counts
// are messages written by the OTHER side after it. conversations.updatedAt is
// bumped on every new message so the inbox can sort by recency.
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueParticipant: uniqueIndex("unique_participant").on(
      table.conversationId,
      table.userId
    ),
  })
)

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    conversationMessageIdx: index("conversation_message_idx").on(
      table.conversationId,
      table.createdAt
    ),
  })
)

// --- CONNECTIONS (request/accept "friendship" between registered users) ---
// A row means `followerId` has a connection toward `followeeId`. A friendship is
// two symmetric rows pointing at each other, both `status = 'accepted'`; a
// single `pending` row is an open request that the other user accepts (mirror
// inserted) or declines (row deleted). Legacy one-way accepted rows are mirrored
// by a boot-time backfill so every accepted connection is symmetric — which is
// what makes the mutual-message gate (both directions accepted) trivial to
// compute and lets the People tab mean "my friends". The unique index keeps the
// two directions independently idempotent.
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: uuid("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "accepted"] })
      .notNull()
      .default("accepted"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueConnection: uniqueIndex("unique_connection").on(
      table.followerId,
      table.followeeId
    ),
    // Incoming-request lookups (who has a pending row to me) filter on followee
    // + status — partial index keeps them cheap as the graph grows.
    incomingPendingIdx: index("connections_incoming_pending_idx")
      .on(table.followeeId)
      .where(sql`${table.status} = 'pending'`),
  })
)

// --- NOTIFICATIONS (in-app events for registered users) ---
// One row per event worth surfacing: a connection request/accepted, an up/down
// vote on your comment, a place a connection unlocked, a new 1:1 message. The
// denormalized `context` carries the snippet shown in the popup (place name,
// trimmed comment body, …) so the feed renders without joins. Guests are never
// recipients (every event targets a registered user); actorUserId is null for
// system-ish events, though none today are.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    type: text("type", {
      enum: [
        "connection_request",
        "connection_accepted",
        "comment_vote",
        "comment",
        "place_unlock",
        "message",
        "follow",
        "group_added",
        "group_message",
      ],
    }).notNull(),
    // Comment id | place id | conversation id — the target of the event.
    refId: uuid("ref_id"),
    context: text("context"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    readAt: timestamp("read_at"), // null = unread
  },
  (table) => ({
    // The inbox/poller reads a single recipient's feed newest-first.
    recipientFeedIdx: index("notifications_recipient_feed_idx").on(
      table.recipientUserId,
      table.createdAt
    ),
    // Anti-burst dedup guard for unlock notifications (≤1 per actor→recipient
    // per 15 min) — one indexed lookup on (actor, recipient, type).
    actorRecipientTypeIdx: index("notifications_actor_recipient_type_idx").on(
      table.actorUserId,
      table.recipientUserId,
      table.type
    ),
  })
)

// ============================================
// RELATIONS
// ============================================

export const placesRelations = relations(places, ({ one, many }) => ({
  parent: one(places, {
    fields: [places.parentId],
    references: [places.id],
    relationName: "place_hierarchy",
  }),
  children: many(places, {
    relationName: "place_hierarchy",
  }),
  unlockedBy: many(unlockedPlaces),
  exploration: many(placeExploration),
  pins: many(pins),
  recentlyVisited: many(recentlyVisited),
  comments: many(comments, { relationName: "comments_place_target" }),
}))

export const unlockedPlacesRelations = relations(unlockedPlaces, ({ one }) => ({
  place: one(places, { fields: [unlockedPlaces.placeId], references: [places.id] }),
  user: one(users, { fields: [unlockedPlaces.userId], references: [users.id] }),
  guest: one(guests, { fields: [unlockedPlaces.guestId], references: [guests.id] }),
  pin: one(pins, { fields: [unlockedPlaces.pinId], references: [pins.id] }),
}))

export const placeExplorationRelations = relations(placeExploration, ({ one }) => ({
  place: one(places, { fields: [placeExploration.placeId], references: [places.id] }),
  user: one(users, { fields: [placeExploration.userId], references: [users.id] }),
  guest: one(guests, { fields: [placeExploration.guestId], references: [guests.id] }),
}))

export const pinsRelations = relations(pins, ({ one, many }) => ({
  user: one(users, { fields: [pins.userId], references: [users.id] }),
  guest: one(guests, { fields: [pins.guestId], references: [guests.id] }),
  category: one(categories, { fields: [pins.categoryId], references: [categories.id] }),
  place: one(places, { fields: [pins.placeId], references: [places.id] }),
  comments: many(comments, { relationName: "comments_pin_target" }),
  routeStartComments: many(comments, { relationName: "comments_route_start" }),
  routeEndComments: many(comments, { relationName: "comments_route_end" }),
}))

export const categoriesRelations = relations(categories, ({ many }) => ({
  pins: many(pins),
}))

export const usersRelations = relations(users, ({ many }) => ({
  categories: many(categories),
  unlockedPlaces: many(unlockedPlaces),
  pins: many(pins),
  recentlyVisited: many(recentlyVisited),
  comments: many(comments),
  commentVotes: many(commentVotes),
  receivedNotifications: many(notifications, {
    relationName: "notifications_recipient",
  }),
  sentNotifications: many(notifications, {
    relationName: "notifications_actor",
  }),
  following: many(follows, { relationName: "follows_follower" }),
  followers: many(follows, { relationName: "follows_followee" }),
  groupsCreated: many(groups),
  groupMemberships: many(groupMembers),
  groupMessages: many(groupMessages),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientUserId],
    references: [users.id],
    relationName: "notifications_recipient",
  }),
  actor: one(users, {
    fields: [notifications.actorUserId],
    references: [users.id],
    relationName: "notifications_actor",
  }),
}))

export const guestsRelations = relations(guests, ({ many }) => ({
  categories: many(categories),
  unlockedPlaces: many(unlockedPlaces),
  pins: many(pins),
  recentlyVisited: many(recentlyVisited),
}))

export const recentlyVisitedRelations = relations(recentlyVisited, ({ one }) => ({
  user: one(users, {
    fields: [recentlyVisited.userId],
    references: [users.id],
  }),
  guest: one(guests, {
    fields: [recentlyVisited.guestId],
    references: [guests.id],
  }),
  place: one(places, {
    fields: [recentlyVisited.placeId],
    references: [places.id],
  }),
  pin: one(pins, {
    fields: [recentlyVisited.pinId],
    references: [pins.id],
  }),
}))

export const commentsRelations = relations(comments, ({ one, many }) => ({
  author: one(users, { fields: [comments.authorUserId], references: [users.id] }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "comment_thread",
  }),
  replies: many(comments, { relationName: "comment_thread" }),
  votes: many(commentVotes),
  pin: one(pins, {
    fields: [comments.pinId],
    references: [pins.id],
    relationName: "comments_pin_target",
  }),
  place: one(places, {
    fields: [comments.placeId],
    references: [places.id],
    relationName: "comments_place_target",
  }),
  routeStartPin: one(pins, {
    fields: [comments.routeStartPinId],
    references: [pins.id],
    relationName: "comments_route_start",
  }),
  routeEndPin: one(pins, {
    fields: [comments.routeEndPinId],
    references: [pins.id],
    relationName: "comments_route_end",
  }),
}))

export const commentVotesRelations = relations(commentVotes, ({ one }) => ({
  comment: one(comments, { fields: [commentVotes.commentId], references: [comments.id] }),
  user: one(users, { fields: [commentVotes.userId], references: [users.id] }),
}))

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "follows_follower",
  }),
  followee: one(users, {
    fields: [follows.followeeId],
    references: [users.id],
    relationName: "follows_followee",
  }),
}))

export const groupsRelations = relations(groups, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [groups.createdByUserId],
    references: [users.id],
  }),
  members: many(groupMembers),
  messages: many(groupMessages),
}))

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}))

export const groupMessagesRelations = relations(groupMessages, ({ one }) => ({
  group: one(groups, { fields: [groupMessages.groupId], references: [groups.id] }),
  author: one(users, { fields: [groupMessages.authorUserId], references: [users.id] }),
}))
