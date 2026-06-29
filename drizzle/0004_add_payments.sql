ALTER TABLE "payment_plans" ADD COLUMN "plan_type" text DEFAULT 'monthly' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_plans" ADD COLUMN "hours_included" integer;
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"purchase_type" text NOT NULL,
	"total_amount" integer NOT NULL,
	"payment_method" text NOT NULL,
	"notes" text,
	"paid_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"item_type" text NOT NULL,
	"payment_plan_id" integer NOT NULL,
	"course_id" integer,
	"amount" integer NOT NULL,
	"hours_granted" integer
);
--> statement-breakpoint
CREATE TABLE "student_entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"payment_id" integer NOT NULL,
	"entitlement_type" text NOT NULL,
	"payment_plan_id" integer NOT NULL,
	"course_id" integer,
	"hours_remaining" integer,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_payment_plan_id_payment_plans_id_fk" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_entitlements" ADD CONSTRAINT "student_entitlements_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_entitlements" ADD CONSTRAINT "student_entitlements_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_entitlements" ADD CONSTRAINT "student_entitlements_payment_plan_id_payment_plans_id_fk" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_entitlements" ADD CONSTRAINT "student_entitlements_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;
