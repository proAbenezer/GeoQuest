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

// --- PINS ---
export const pins = pgTable("pins", {
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

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
