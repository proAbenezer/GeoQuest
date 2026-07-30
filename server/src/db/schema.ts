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
  AnyPgColumn
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

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
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
})

// --- GEOGRAPHIC HIERARCHY (UNIFIED PLACES) ---

export const places = pgTable("places", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // e.g., "Oromia", "Addis Ababa", "Shashemene", "Bole", "Abosto"
  
  // 1 = Region/Chartered City | 2 = City/Sub-city | 3 = District/Woreda | 4 = Locality
  adminLevel: integer("admin_level").notNull(),
  
  // 'chartered_city', 'region', 'city', 'sub_city', 'district', 'woreda', 'locality'
  levelType: text("level_type").notNull(), 
  
  // Self-referencing link (e.g., Bole -> Addis Ababa, Abosto -> Shashemene)
  parentId: uuid("parent_id").references((): AnyPgColumn => places.id, {
    onDelete: "cascade",
  }),
  
  countryCode: text("country_code").notNull().default("ET"), // ISO code ("ET", "KE", "US")
  shapeId: text("shape_id").unique(),
  boundary: multiPolygon("boundary"),
})

// --- UNLOCKED PROGRESS ---

export const unlockedPlaces = pgTable("unlocked_places", {
  id: uuid("id").primaryKey().defaultRandom(),
  placeId: uuid("place_id")
    .notNull()
    .references(() => places.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestId: uuid("guest_id").references(() => guests.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
})

// --- PINS ---

export const pins = pgTable("pins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestId: uuid("guest_id").references(() => guests.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  placeId: uuid("place_id").references(() => places.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  notes: text("notes"),
  visitDate: date("visit_date"),
  visited: boolean("visited").notNull().default(false),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  imageUrl: text("image_url"),
  saved: boolean("saved").default(false),
})

// --- RELATIONS ---

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
