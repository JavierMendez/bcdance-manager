CREATE TABLE "class_attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"entitlement_id" integer NOT NULL,
	"entitlement_type" text NOT NULL,
	"session_date" date NOT NULL,
	"status" text NOT NULL,
	"hours_deducted" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_attendance_student_course_date_entitlement" UNIQUE("student_id","course_id","session_date","entitlement_id")
);
--> statement-breakpoint
ALTER TABLE "class_attendance" ADD CONSTRAINT "class_attendance_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_attendance" ADD CONSTRAINT "class_attendance_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "class_attendance" ADD CONSTRAINT "class_attendance_entitlement_id_student_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."student_entitlements"("id") ON DELETE no action ON UPDATE no action;
