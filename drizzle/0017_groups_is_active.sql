ALTER TABLE "groups" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE "groups"
SET "is_active" = (
	(timezone('America/Mexico_City', now()))::date >= "start_date"
	AND (timezone('America/Mexico_City', now()))::date <= "end_date"
)
WHERE "start_date" IS NOT NULL AND "end_date" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "start_date" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "end_date" DROP NOT NULL;
