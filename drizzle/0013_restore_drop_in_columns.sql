ALTER TABLE "student_entitlements" ADD COLUMN IF NOT EXISTS "classes_remaining" integer;
--> statement-breakpoint
ALTER TABLE "payment_items" ADD COLUMN IF NOT EXISTS "classes_granted" integer;
--> statement-breakpoint
ALTER TABLE "class_attendance" ADD COLUMN IF NOT EXISTS "classes_deducted" integer DEFAULT 0 NOT NULL;
