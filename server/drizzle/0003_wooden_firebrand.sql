ALTER TABLE "countries" ALTER COLUMN "boundary" SET DATA TYPE geometry(MultiPolygon,4326);--> statement-breakpoint
ALTER TABLE "districts" ALTER COLUMN "boundary" SET DATA TYPE geometry(MultiPolygon,4326);--> statement-breakpoint
ALTER TABLE "regions" ALTER COLUMN "boundary" SET DATA TYPE geometry(MultiPolygon,4326);