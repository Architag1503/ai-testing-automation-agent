import nextEnv from "@next/env";
import { execSync } from "child_process";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl || dbUrl.includes("placeholder-url") || dbUrl.trim() === "") {
  console.log("ℹ️ [db:migrate] DATABASE_URL is not configured in build environment. Skipping build-time migration.");
  process.exit(0);
}

try {
  console.log("🚀 [db:migrate] Executing drizzle-kit migrate...");
  execSync("npx drizzle-kit migrate", { stdio: "inherit", shell: true, env: process.env });
  console.log("✅ [db:migrate] Database migration completed.");
} catch (error) {
  console.error("❌ [db:migrate] Database migration failed:", error.message);
  process.exit(1);
}
