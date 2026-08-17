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
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const guests = pgTable("guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestId: uuid("guest_id").references(() => guests.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
})

// --- GEOGRAPHIC HIERARCHY (UNIFIED PLACES) ---
export const places = pgTable("places", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // e.g., "Oromia", "Addis Ababa", "Shashemene", "Bole", "Abosto"

  // Depth in the tree, RELATIVE to this country's own data — not a fixed global meaning.
  // 0 = country root. Beyond that, depth varies per country depending on how many
  // admin levels geoBoundaries provides (some countries: 2 levels, others: 4+).
  // Always resolve meaning via levelType + parentId chain, never assume adminLevel
  // maps to the same real-world thing across two different countries.
  adminLevel: integer("admin_level").notNull(),

  // 'country', 'chartered_city', 'region', 'city', 'sub_city', 'district', 'woreda', 'locality'
  levelType: text("level_type").notNull(),

  // Self-referencing link (e.g., Bole -> Addis Ababa, Abosto -> Shashemene)
  parentId: uuid("parent_id").references((): AnyPgColumn => places.id, {
    onDelete: "cascade",
  }),

  countryCode: text("country_code").notNull(), // ISO code ("ET", "KE", "US")
  shapeId: text("shape_id").unique(),
  boundary: multiPolygon("boundary"),
})

// --- COUNTRY FETCH / CACHE STATUS ---
export const countryFetchStatus = pgTable("country_fetch_status", {
  countryCode: text("country_code").primaryKey(), // ISO code, e.g. "ET"
  status: text("status").notNull().default("not_cached"), // not_cached | fetching | cached | failed
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
  },
  (table) => ({
    // Prevents the same registered user from unlocking the same place twice.
    // Partial unique index: only enforced when userId is set.
    uniqueUserUnlock: uniqueIndex("unique_user_unlock")
      .on(table.placeId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    // Prevents the same guest from unlocking the same place twice.
    // Partial unique index: only enforced when guestId is set.
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
  customName: text("custom_name"), // user's own personal name for the pin, separate from the official place name
  description: text("description").notNull(),
  customDescription: text("custom_description"), // user's own notes, separate from any official description
  notes: text("notes"),
  visitDate: date("visit_date"),
  visited: boolean("visited").notNull().default(false),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  imageUrl: text("image_url"),
  saved: boolean("saved").default(false),
})// --- RELATIONS ---
export const placesRelations = relations(places, ({ one, many }) => ({
  // Parent location (e.g., Bole's parent is Addis Ababa)
  parent: one(places, {
    fields: [places.parentId],
    references: [places.id],
    relationName: "place_hierarchy",
  }),
  // Child locations (e.g., Addis Ababa's children are Bole, Arada, etc.)
  children: many(places, {
    relationName: "place_hierarchy",
  }),
  unlockedBy: many(unlockedPlaces),
  pins: many(pins),
}))

export const unlockedPlacesRelations = relations(unlockedPlaces, ({ one }) => ({
  place: one(places, { fields: [unlockedPlaces.placeId], references: [places.id] }),
  user: one(users, { fields: [unlockedPlaces.userId], references: [users.id] }),
  guest: one(guests, { fields: [unlockedPlaces.guestId], references: [guests.id] }),
}))

export const pinsRelations = relations(pins, ({ one }) => ({
  user: one(users, { fields: [pins.userId], references: [users.id] }),
  guest: one(guests, { fields: [pins.guestId], references: [guests.id] }),
  category: one(categories, { fields: [pins.categoryId], references: [categories.id] }),
  place: one(places, { fields: [pins.placeId], references: [places.id] }),
}))
