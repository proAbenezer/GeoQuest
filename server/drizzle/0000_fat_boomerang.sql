CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country_fetch_status" (
	"country_code" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'not_cached' NOT NULL,
	"requested_at" timestamp,
	"completed_at" timestamp,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"guest_id" uuid,
	"category_id" uuid,
	"place_id" uuid,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"notes" text,
	"visit_date" date,
	"visited" boolean DEFAULT false NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"image_url" text,
	"saved" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"admin_level" integer NOT NULL,
	"level_type" text NOT NULL,
	"parent_id" uuid,
	"country_code" text NOT NULL,
	"shape_id" text,
	"boundary" geometry(MultiPolygon,4326),
	CONSTRAINT "places_shape_id_unique" UNIQUE("shape_id")
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
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_parent_id_places_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlocked_places" ADD CONSTRAINT "unlocked_places_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlocked_places" ADD CONSTRAINT "unlocked_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlocked_places" ADD CONSTRAINT "unlocked_places_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_unlock" ON "unlocked_places" USING btree ("place_id","user_id") WHERE "unlocked_places"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_guest_unlock" ON "unlocked_places" USING btree ("place_id","guest_id") WHERE "unlocked_places"."guest_id" IS NOT NULL;