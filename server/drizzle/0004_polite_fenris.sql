CREATE TABLE "localities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"shape_id" text,
	"boundary" geometry(MultiPolygon,4326),
	CONSTRAINT "localities_shape_id_unique" UNIQUE("shape_id")
);
--> statement-breakpoint
ALTER TABLE "pins" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pins" ADD COLUMN "guest_id" uuid;--> statement-breakpoint
ALTER TABLE "pins" ADD COLUMN "locality_id" uuid;--> statement-breakpoint
ALTER TABLE "localities" ADD CONSTRAINT "localities_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE set null ON UPDATE no action;