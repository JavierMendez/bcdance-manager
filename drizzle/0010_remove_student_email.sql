ALTER TABLE "students" DROP CONSTRAINT "students_email_unique";
--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "email";
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_phone_unique" UNIQUE("phone");
