ALTER TABLE "pins" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "pins" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "unlocked_places" ADD COLUMN "last_accessed_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "unlocked_places" ADD COLUMN "is_pinned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "unlocked_places" ADD COLUMN "pin_id" uuid;--> statement-breakpoint
ALTER TABLE "unlocked_places" ADD CONSTRAINT "unlocked_places_pin_id_pins_id_fk" FOREIGN KEY ("pin_id") REFERENCES "public"."pins"("id") ON DELETE set null ON UPDATE no action;