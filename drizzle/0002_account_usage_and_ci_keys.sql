ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "usage_generations" integer NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "usage_runs" integer NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "usage_period_start" timestamp NOT NULL DEFAULT now();
ALTER TABLE "users" ALTER COLUMN "credits" SET DEFAULT 200;
ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "ci_api_key" text;
CREATE UNIQUE INDEX IF NOT EXISTS "repositories_ci_api_key_unique" ON "repositories" ("ci_api_key");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_razorpay_payment_id_unique"
  ON "subscriptions" ("razorpay_payment_id");
