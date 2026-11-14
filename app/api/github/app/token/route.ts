import { NextResponse } from "next/server";
import { getAuthenticatedAccount, getAuthenticatedClerkGitHubUsername } from "@/lib/account";
import { findInstallationForUser, getInstallationAccessToken } from "@/lib/github-app";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const account = await getAuthenticatedAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let installationId = account.installationId;

    if (!installationId) {
      const githubUsername = await getAuthenticatedClerkGitHubUsername();
      const detectedId = await findInstallationForUser(githubUsername, account.email);
      if (detectedId) {
        await db.update(users).set({ installationId: detectedId }).where(eq(users.id, account.id));
        installationId = detectedId;
      }
    }

    if (!installationId) return NextResponse.json({ error: "GitHub App not installed" }, { status: 404 });
    // Mint credentials only for server-to-server use. Never return the installation token.
    await getInstallationAccessToken(installationId);
    return NextResponse.json({ connected: true });
  } catch {
    return NextResponse.json({ error: "GitHub installation is unavailable; reconnect the app" }, { status: 401 });
  }
}
