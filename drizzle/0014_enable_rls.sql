-- Enable RLS on all public tables exposed to PostgREST.
-- Access is server-side via DATABASE_URL (bypasses RLS); no policies for anon/authenticated.
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payment_plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payment_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "student_entitlements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "class_attendance" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
		AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
	THEN
		REVOKE ALL ON TABLE "students" FROM anon, authenticated;
		REVOKE ALL ON TABLE "programs" FROM anon, authenticated;
		REVOKE ALL ON TABLE "groups" FROM anon, authenticated;
		REVOKE ALL ON TABLE "payment_plans" FROM anon, authenticated;
		REVOKE ALL ON TABLE "payments" FROM anon, authenticated;
		REVOKE ALL ON TABLE "payment_items" FROM anon, authenticated;
		REVOKE ALL ON TABLE "student_entitlements" FROM anon, authenticated;
		REVOKE ALL ON TABLE "class_attendance" FROM anon, authenticated;
		REVOKE ALL ON TABLE "expenses" FROM anon, authenticated;
		REVOKE ALL ON TABLE "user" FROM anon, authenticated;
		REVOKE ALL ON TABLE "session" FROM anon, authenticated;
		REVOKE ALL ON TABLE "account" FROM anon, authenticated;
		REVOKE ALL ON TABLE "verification" FROM anon, authenticated;
	END IF;
END $$;
