CREATE TABLE "place_exploration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_id" uuid,
	"explored" boolean DEFAULT false NOT NULL,
	"percent" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "place_exploration" ADD CONSTRAINT "place_exploration_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_exploration" ADD CONSTRAINT "place_exploration_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_exploration" ADD CONSTRAINT "place_exploration_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_exploration" ON "place_exploration" USING btree ("place_id","user_id") WHERE "place_exploration"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_guest_exploration" ON "place_exploration" USING btree ("place_id","guest_id") WHERE "place_exploration"."guest_id" IS NOT NULL;