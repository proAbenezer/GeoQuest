ALTER TABLE "categories" ADD COLUMN "icons" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "pins" ADD COLUMN "icons" text[] DEFAULT '{}'::text[] NOT NULL;