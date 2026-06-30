CREATE TABLE "programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"schedule" text NOT NULL,
	"days" text[] NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "course_to_group_map" (
	"course_id" integer PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"group_id" integer NOT NULL
);
--> statement-breakpoint
DO $$
DECLARE
	course_row RECORD;
	new_program_id integer;
	new_group_id integer;
BEGIN
	FOR course_row IN SELECT * FROM "courses" ORDER BY "id" LOOP
		INSERT INTO "programs" ("name", "description", "created_at", "updated_at")
		VALUES (course_row."name", course_row."description", course_row."created_at", course_row."updated_at")
		RETURNING "id" INTO new_program_id;

		INSERT INTO "groups" ("program_id", "schedule", "days", "start_date", "end_date", "created_at", "updated_at")
		VALUES (
			new_program_id,
			course_row."schedule",
			course_row."days",
			course_row."start_date",
			course_row."end_date",
			course_row."created_at",
			course_row."updated_at"
		)
		RETURNING "id" INTO new_group_id;

		INSERT INTO "course_to_group_map" ("course_id", "program_id", "group_id")
		VALUES (course_row."id", new_program_id, new_group_id);
	END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "student_entitlements" ADD COLUMN "group_id" integer;
--> statement-breakpoint
UPDATE "student_entitlements" AS se
SET "group_id" = map."group_id"
FROM "course_to_group_map" AS map
WHERE se."course_id" = map."course_id";
--> statement-breakpoint
ALTER TABLE "student_entitlements" DROP CONSTRAINT IF EXISTS "student_entitlements_course_id_courses_id_fk";
--> statement-breakpoint
ALTER TABLE "student_entitlements" DROP COLUMN "course_id";
--> statement-breakpoint
ALTER TABLE "student_entitlements" ADD CONSTRAINT "student_entitlements_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_items" ADD COLUMN "group_id" integer;
--> statement-breakpoint
UPDATE "payment_items" AS pi
SET "group_id" = map."group_id"
FROM "course_to_group_map" AS map
WHERE pi."course_id" = map."course_id";
--> statement-breakpoint
ALTER TABLE "payment_items" DROP CONSTRAINT IF EXISTS "payment_items_course_id_courses_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_items" DROP COLUMN "course_id";
--> statement-breakpoint
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_attendance" ADD COLUMN "group_id" integer;
--> statement-breakpoint
UPDATE "class_attendance" AS ca
SET "group_id" = map."group_id"
FROM "course_to_group_map" AS map
WHERE ca."course_id" = map."course_id";
--> statement-breakpoint
ALTER TABLE "class_attendance" ALTER COLUMN "group_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "class_attendance" DROP CONSTRAINT "class_attendance_student_course_date_entitlement";
--> statement-breakpoint
ALTER TABLE "class_attendance" DROP CONSTRAINT IF EXISTS "class_attendance_course_id_courses_id_fk";
--> statement-breakpoint
ALTER TABLE "class_attendance" DROP COLUMN "course_id";
--> statement-breakpoint
ALTER TABLE "class_attendance" ADD CONSTRAINT "class_attendance_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_attendance" ADD CONSTRAINT "class_attendance_student_group_date_entitlement" UNIQUE("student_id","group_id","session_date","entitlement_id");
--> statement-breakpoint
DROP TABLE "course_to_group_map";
--> statement-breakpoint
DROP TABLE "courses";
