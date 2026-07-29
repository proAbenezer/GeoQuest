import {
  pgTable,
  uuid,
  text,
  boolean,
  doublePrecision,
  timestamp,
  date,
  customType
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

const multiPolygon = customType<{ data: string }>({
  dataType() {
    return "geometry(MultiPolygon,4326)"
  },
})

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  passwordHash: text("password_hash").notNull(),
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

export const countries = pgTable("countries", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  shapeId: text("shape_id").notNull().unique(),
  boundary: multiPolygon("boundary").notNull(),
})

export const regions = pgTable("regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  countryId: uuid("country_id")
    .notNull()
    .references(() => countries.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  shapeId: text("shape_id").notNull().unique(),
  boundary: multiPolygon("boundary").notNull(),
})

export const districts = pgTable("districts", {
  id: uuid("id").primaryKey().defaultRandom(),
  regionId: uuid("region_id")
    .notNull()
    .references(() => regions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  shapeId: text("shape_id").notNull().unique(),
  boundary: multiPolygon("boundary").notNull(),
})

export const guests = pgTable("guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const unlockedDistricts = pgTable("unlocked_districts", {
  id: uuid("id").primaryKey().defaultRandom(),
  districtId: uuid("district_id")
    .notNull()
    .references(() => districts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestId: uuid("guest_id").references(() => guests.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
})

export const pins = pgTable("pins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  districtId: uuid("district_id").references(() => districts.id, {
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

// --- Relational query API config (for db.query.x.findFirst/findMany with `with: {...}`) ---
// These are separate from the FK constraints above: the FKs enforce DB-level integrity,
// these tell Drizzle's query builder how to perform joins.

export const unlockedDistrictsRelations = relations(unlockedDistricts, ({ one }) => ({
  district: one(districts, {
    fields: [unlockedDistricts.districtId],
    references: [districts.id],
  }),
  user: one(users, {
    fields: [unlockedDistricts.userId],
    references: [users.id],
  }),
  guest: one(guests, {
    fields: [unlockedDistricts.guestId],
    references: [guests.id],
  }),
}))

export const districtsRelations = relations(districts, ({ one, many }) => ({
  region: one(regions, {
    fields: [districts.regionId],
    references: [regions.id],
  }),
  unlockedBy: many(unlockedDistricts),
  pins: many(pins),
}))

export const regionsRelations = relations(regions, ({ one, many }) => ({
  country: one(countries, {
    fields: [regions.countryId],
    references: [countries.id],
  }),
  districts: many(districts),
}))

export const countriesRelations = relations(countries, ({ many }) => ({
  regions: many(regions),
}))
