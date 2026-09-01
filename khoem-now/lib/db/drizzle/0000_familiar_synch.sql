CREATE TABLE "cai_scans" (
	"id" text PRIMARY KEY NOT NULL,
	"operator_id" text NOT NULL,
	"category" text NOT NULL,
	"batch_id" text NOT NULL,
	"total_count" integer NOT NULL,
	"detected_types" text[] NOT NULL,
	"hash_signature" text NOT NULL,
	"ai_assisted" boolean DEFAULT false NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cai_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cai_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "cai_scans" ADD CONSTRAINT "cai_scans_operator_id_cai_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."cai_users"("id") ON DELETE no action ON UPDATE no action;
