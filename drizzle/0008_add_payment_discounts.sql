ALTER TABLE "payments" ADD COLUMN "subtotal_amount" integer;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "discount_percent" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "payments" SET "subtotal_amount" = "total_amount" WHERE "subtotal_amount" IS NULL;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "subtotal_amount" SET NOT NULL;
