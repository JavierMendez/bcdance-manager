CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"amount" integer NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"payment_method" text NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
