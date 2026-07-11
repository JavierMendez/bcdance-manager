ALTER TABLE "students" DROP CONSTRAINT "students_phone_unique";
--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "phone" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "guid" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_guid_unique" UNIQUE("guid");
