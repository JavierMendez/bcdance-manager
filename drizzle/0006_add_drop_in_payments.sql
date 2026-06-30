ALTER TABLE "student_entitlements" ADD COLUMN "classes_remaining" integer;
--> statement-breakpoint
ALTER TABLE "payment_items" ADD COLUMN "classes_granted" integer;
--> statement-breakpoint
ALTER TABLE "class_attendance" ADD COLUMN "classes_deducted" integer DEFAULT 0 NOT NULL;
