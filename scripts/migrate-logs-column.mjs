import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log("Running migration: ALTER logs column to jsonb...");
  try {
    await sql`
      ALTER TABLE test_cases
        ALTER COLUMN logs TYPE jsonb
        USING CASE
          WHEN logs IS NULL THEN NULL
          ELSE logs::jsonb
        END
    `;
    console.log("✅  logs column successfully migrated to jsonb.");
  } catch (err) {
    // Column might already be jsonb or might not exist yet — both are fine
    console.log("ℹ️  Migration note:", err.message);
  }
}

main();
