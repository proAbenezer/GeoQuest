ALTER TABLE "cities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "unlocked_cities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "cities" CASCADE;--> statement-breakpoint
DROP TABLE "unlocked_cities" CASCADE;--> statement-breakpoint
ALTER TABLE "pins" DROP CONSTRAINT "pins_city_id_cities_id_fk";
--> statement-breakpoint
ALTER TABLE "places" DROP CONSTRAINT "places_city_id_cities_id_fk";
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "admin_level" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "level_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "country_code" text DEFAULT 'ET' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_parent_id_places_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" DROP COLUMN "city_id";--> statement-breakpoint
ALTER TABLE "places" DROP COLUMN "city_id";--> statement-breakpoint
ALTER TABLE "places" DROP COLUMN "type";