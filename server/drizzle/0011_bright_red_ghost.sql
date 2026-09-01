CREATE TABLE "travel_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"guest_id" uuid,
	"country_code" text NOT NULL,
	"country_name" text NOT NULL,
	"places_count" integer DEFAULT 0 NOT NULL,
	"days" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"first_visit_at" timestamp,
	"last_visit_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "area" double precision;--> statement-breakpoint
ALTER TABLE "unlocked_places" ADD COLUMN "timezone_offset_minutes" integer;--> statement-breakpoint
ALTER TABLE "travel_stats" ADD CONSTRAINT "travel_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_stats" ADD CONSTRAINT "travel_stats_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_country" ON "travel_stats" USING btree ("user_id","country_code") WHERE "travel_stats"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_guest_country" ON "travel_stats" USING btree ("country_code","guest_id") WHERE "travel_stats"."guest_id" IS NOT NULL;