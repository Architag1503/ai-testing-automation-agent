CREATE TABLE "test_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"repo_id" varchar(255),
	"repo_name" varchar(255) NOT NULL,
	"repo_owner" varchar(255) NOT NULL,
	"branch" varchar(100) DEFAULT 'main',
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"type" varchar(100) NOT NULL,
	"priority" varchar(50) NOT NULL,
	"target_route" varchar(500),
	"target_files" jsonb DEFAULT '[]'::jsonb,
	"expected_result" text,
	"browserbase_script" text,
	"status" varchar(100) DEFAULT 'generated',
	"created_at" timestamp DEFAULT now(),
	"logs" jsonb DEFAULT '[]'::jsonb,
	"session_id" varchar(255),
	"session_url" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"repo_id" integer NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"private" integer NOT NULL,
	"html_url" text NOT NULL,
	"description" text,
	"owner" text NOT NULL,
	"language" text,
	"default_branch" text,
	"target_domain" varchar DEFAULT 'http://localhost:3000',
	"global_instruction" text
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plan_name" text NOT NULL,
	"plan_badge" text,
	"credits_to_grant" integer DEFAULT 0 NOT NULL,
	"price_monthly" integer,
	"price_annually" integer,
	"billing_period" text,
	"is_active" integer DEFAULT 0 NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"credits" integer DEFAULT 1000 NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;