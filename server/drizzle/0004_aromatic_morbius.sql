CREATE TABLE "recently_visited" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"guest_id" uuid,
	"place_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"first_visited_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp DEFAULT now() NOT NULL,
	"is_pinned" boolean DEFAULT false,
	"pin_id" uuid,
	"visit_count" integer DEFAULT 1,
	"auto_tracked" boolean DEFAULT true
);
--> statement-breakpoint
ALTER TABLE "recently_visited" ADD CONSTRAINT "recently_visited_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_visited" ADD CONSTRAINT "recently_visited_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_visited" ADD CONSTRAINT "recently_visited_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_visited" ADD CONSTRAINT "recently_visited_pin_id_pins_id_fk" FOREIGN KEY ("pin_id") REFERENCES "public"."pins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_place" ON "recently_visited" USING btree ("place_id","user_id") WHERE "recently_visited"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_guest_place" ON "recently_visited" USING btree ("place_id","guest_id") WHERE "recently_visited"."guest_id" IS NOT NULL;