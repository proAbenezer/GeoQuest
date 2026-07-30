CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"shape_id" text,
	"boundary" geometry(MultiPolygon,4326),
	CONSTRAINT "cities_shape_id_unique" UNIQUE("shape_id")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"shape_id" text,
	"boundary" geometry(MultiPolygon,4326),
	CONSTRAINT "places_shape_id_unique" UNIQUE("shape_id")
);
--> statement-breakpoint
CREATE TABLE "unlocked_cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_id" uuid,
	"unlocked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unlocked_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_id" uuid,
	"unlocked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "countries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "districts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "localities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "regions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "unlocked_districts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "countries" CASCADE;--> statement-breakpoint
DROP TABLE "districts" CASCADE;--> statement-breakpoint
DROP TABLE "localities" CASCADE;--> statement-breakpoint
DROP TABLE "regions" CASCADE;--> statement-breakpoint
DROP TABLE "unlocked_districts" CASCADE;--> statement-breakpoint
ALTER TABLE "pins" RENAME COLUMN "locality_id" TO "place_id";--> statement-breakpoint
ALTER TABLE "pins" DROP CONSTRAINT "pins_district_id_districts_id_fk";
--> statement-breakpoint
ALTER TABLE "pins" DROP CONSTRAINT "pins_locality_id_localities_id_fk";
--> statement-breakpoint
ALTER TABLE "pins" ADD COLUMN "city_id" uuid;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlocked_cities" ADD CONSTRAINT "unlocked_cities_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlocked_cities" ADD CONSTRAINT "unlocked_cities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlocked_cities" ADD CONSTRAINT "unlocked_cities_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlocked_places" ADD CONSTRAINT "unlocked_places_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlocked_places" ADD CONSTRAINT "unlocked_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlocked_places" ADD CONSTRAINT "unlocked_places_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" DROP COLUMN "district_id";